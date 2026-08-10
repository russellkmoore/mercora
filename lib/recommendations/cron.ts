import {
  rebuildProductRecommendations,
  type RecommendationRebuildSummary,
} from "./batch/rebuild";

type RecommendationBindings = Pick<CloudflareEnv, "AI" | "DB" | "VECTORIZE">;
type Rebuild = (
  env: RecommendationBindings,
) => Promise<RecommendationRebuildSummary>;

export async function runRecommendationCron(
  env: RecommendationBindings,
  rebuild: Rebuild = rebuildProductRecommendations,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const summary = await rebuild(env);
    const details = {
      event: "recommendations.rebuild",
      durationMs: Date.now() - startedAt,
      ...summary,
    };

    if (summary.errors.length > 0) {
      console.error(JSON.stringify({ ...details, outcome: "partial_failure" }));
      throw new Error(
        `Recommendation rebuild failed for ${summary.errors.length} product(s)`,
      );
    }

    if (summary.rowsWritten === 0) {
      console.warn(JSON.stringify({ ...details, outcome: "no_rows_written" }));
      return;
    }

    if (summary.staleRowCount > 0) {
      console.warn(JSON.stringify({ ...details, outcome: "stale_rows" }));
    }

    if (summary.productsDeferred > 0) {
      console.warn(JSON.stringify({ ...details, outcome: "catalog_truncated" }));
    }

    console.log(JSON.stringify({ ...details, outcome: "success" }));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "recommendations.rebuild",
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}
