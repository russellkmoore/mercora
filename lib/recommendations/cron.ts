import {
  rebuildProductRecommendations,
  type RecommendationRebuildSummary,
} from "./batch/rebuild";
import { recordTelemetry } from "@/lib/observability/telemetry";

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
      throw new Error(
        `Recommendation rebuild failed for ${summary.errors.length} product(s)`,
      );
    }

    if (summary.rowsWritten === 0) {
      recordTelemetry("recommendation.no_rows_written", {
        operation: "rebuild", count: summary.catalogProducts,
        duration_ms: details.durationMs, trigger: "scheduled",
      });
      return;
    }

    if (summary.staleRowCount > 0) {
      recordTelemetry("recommendation.stale_rows", {
        operation: "rebuild", count: summary.staleRowCount,
        duration_ms: details.durationMs, trigger: "scheduled",
      });
    }

    if (summary.productsDeferred > 0) {
      console.warn(JSON.stringify({ ...details, outcome: "catalog_truncated" }));
    }

    console.log(JSON.stringify({ ...details, outcome: "success" }));
  } catch (error) {
    recordTelemetry("recommendation.rebuild_failed", {
      operation: "rebuild", outcome: "failed", duration_ms: Date.now() - startedAt,
      retryable: true, trigger: "scheduled",
    }, error);
    throw error;
  }
}
