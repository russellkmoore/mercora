import { getCurrentEmbeddingModel } from "@/lib/ai/config";

const DEFAULT_NEIGHBORS = 10;
const MAX_NEIGHBORS = 20;
const DEFAULT_PRODUCT_LIMIT = 100;
const MAX_PRODUCT_LIMIT = 500;
const STALENESS_THRESHOLD_DAYS = 7;
const MAX_EMBEDDING_TEXT_LENGTH = 4_000;
const MAX_ERROR_LENGTH = 500;

export interface RebuildProduct {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface RecommendationNeighbor {
  id: string;
  score: number;
}

export interface RecommendationRebuildAdapter {
  countActiveProducts(): Promise<number>;
  listActiveProducts(limit: number): Promise<RebuildProduct[]>;
  embed(product: RebuildProduct): Promise<number[]>;
  queryNeighbors(vector: number[], topK: number): Promise<RecommendationNeighbor[]>;
  replaceRecommendations(sourceId: string, neighbors: RecommendationNeighbor[]): Promise<void>;
  readStaleness(thresholdDays: number): Promise<{
    staleRowCount: number;
    oldestGeneratedAt: string | null;
  }>;
}

export interface RecommendationRebuildSummary {
  catalogProducts: number;
  productsAttempted: number;
  productsDeferred: number;
  productsProcessed: number;
  productsSkipped: number;
  rowsWritten: number;
  errors: Array<{ productId: string; error: string }>;
  stalenessThresholdDays: number;
  staleRowCount: number;
  oldestGeneratedAt: string | null;
}

export interface RecommendationRebuildOptions {
  neighbors?: number;
  productLimit?: number;
}

function boundedInteger(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

export async function rebuildWithAdapter(
  adapter: RecommendationRebuildAdapter,
  options: RecommendationRebuildOptions = {},
): Promise<RecommendationRebuildSummary> {
  const neighborLimit = boundedInteger(options.neighbors, DEFAULT_NEIGHBORS, MAX_NEIGHBORS);
  const productLimit = boundedInteger(
    options.productLimit,
    DEFAULT_PRODUCT_LIMIT,
    MAX_PRODUCT_LIMIT,
  );
  const [catalogProducts, products] = await Promise.all([
    adapter.countActiveProducts(),
    adapter.listActiveProducts(productLimit),
  ]);
  const activeIds = new Set(products.map(({ id }) => id));
  let productsProcessed = 0;
  let productsSkipped = 0;
  let rowsWritten = 0;
  const errors: Array<{ productId: string; error: string }> = [];

  for (const product of products) {
    try {
      const vector = await adapter.embed(product);
      const matches = await adapter.queryNeighbors(vector, neighborLimit + 5);
      const seen = new Set<string>();
      const neighbors: RecommendationNeighbor[] = [];

      for (const match of matches) {
        const id = String(match.id);
        if (id === product.id || !activeIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        neighbors.push({ id, score: Number.isFinite(match.score) ? match.score : 0 });
        if (neighbors.length >= neighborLimit) break;
      }

      // Preserve the last known-good rows if Vectorize is empty or incomplete.
      if (neighbors.length === 0) {
        productsSkipped += 1;
        continue;
      }

      await adapter.replaceRecommendations(product.id, neighbors);
      productsProcessed += 1;
      rowsWritten += neighbors.length;
    } catch (error) {
      console.error("Recommendations rebuild: product failed", {
        productId: product.id,
        error,
      });
      errors.push({ productId: product.id, error: errorMessage(error) });
    }
  }

  let staleRowCount = 0;
  let oldestGeneratedAt: string | null = null;
  try {
    ({ staleRowCount, oldestGeneratedAt } = await adapter.readStaleness(
      STALENESS_THRESHOLD_DAYS,
    ));
  } catch (error) {
    // Reporting should not invalidate recommendation rows already rebuilt.
    console.error("Recommendations rebuild: staleness check failed", error);
  }

  return {
    catalogProducts,
    productsAttempted: products.length,
    productsDeferred: Math.max(0, catalogProducts - products.length),
    productsProcessed,
    productsSkipped,
    rowsWritten,
    errors,
    stalenessThresholdDays: STALENESS_THRESHOLD_DAYS,
    staleRowCount,
    oldestGeneratedAt,
  };
}

type RecommendationBindings = Pick<CloudflareEnv, "AI" | "DB" | "VECTORIZE">;

interface RawProductRow {
  id: string;
  name: string;
  description: string | null;
  tags: string | null;
}

function localizedText(value: string | null): string {
  if (!value) return "";
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed);
      const first = values.find((entry): entry is string => typeof entry === "string");
      return first ?? "";
    }
  } catch {
    return value;
  }
  return "";
}

function parseTags(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function productText(product: RebuildProduct): string {
  return [product.name, product.description, product.tags.join(", ")]
    .filter(Boolean)
    .join(". ")
    .slice(0, MAX_EMBEDDING_TEXT_LENGTH);
}

export function createCloudflareRebuildAdapter(
  env: RecommendationBindings,
): RecommendationRebuildAdapter {
  return {
    async countActiveProducts() {
      const row = await env.DB.prepare(
        "SELECT count(*) AS count FROM products WHERE status = 'active'",
      ).first<{ count: number }>();
      return Number(row?.count ?? 0) || 0;
    },

    async listActiveProducts(limit) {
      const result = await env.DB.prepare(
        "SELECT id, name, description, tags FROM products WHERE status = 'active' ORDER BY id LIMIT ?",
      )
        .bind(limit)
        .all<RawProductRow>();
      return result.results.map((row) => ({
        id: String(row.id),
        name: localizedText(row.name),
        description: localizedText(row.description),
        tags: parseTags(row.tags),
      }));
    },

    async embed(product) {
      const output = await env.AI.run(getCurrentEmbeddingModel(), {
        text: productText(product),
      });
      const vector = "data" in output ? output.data?.[0] : undefined;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Embedding model returned no vector");
      }
      return vector;
    },

    async queryNeighbors(vector, topK) {
      const result = await env.VECTORIZE.query(vector, {
        topK,
        returnMetadata: "all",
      });
      return result.matches.flatMap((match) => {
        const productId = match.metadata?.productId;
        return typeof productId === "string" || typeof productId === "number"
          ? [{ id: String(productId), score: match.score }]
          : [];
      });
    },

    async replaceRecommendations(sourceId, neighbors) {
      const generatedAt = new Date().toISOString();
      const statements = [
        env.DB.prepare(
          "DELETE FROM product_recommendations WHERE source_product_id = ?",
        ).bind(sourceId),
        ...neighbors.map((neighbor, rank) =>
          env.DB.prepare(
            `INSERT INTO product_recommendations
              (source_product_id, recommended_product_id, rank, score, reason, generated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(
            sourceId,
            neighbor.id,
            rank,
            neighbor.score,
            "vector_similarity",
            generatedAt,
          ),
        ),
      ];
      await env.DB.batch(statements);
    },

    async readStaleness(thresholdDays) {
      const modifier = `-${thresholdDays} days`;
      const row = await env.DB.prepare(
        `SELECT
           sum(CASE WHEN datetime(generated_at) < datetime('now', ?) THEN 1 ELSE 0 END) AS stale,
           min(generated_at) AS oldest
         FROM product_recommendations`,
      )
        .bind(modifier)
        .first<{ stale: number | null; oldest: string | null }>();
      return {
        staleRowCount: Number(row?.stale ?? 0) || 0,
        oldestGeneratedAt: row?.oldest ?? null,
      };
    },
  };
}

export async function rebuildProductRecommendations(
  env: RecommendationBindings,
  options: RecommendationRebuildOptions = {},
): Promise<RecommendationRebuildSummary> {
  return rebuildWithAdapter(createCloudflareRebuildAdapter(env), options);
}
