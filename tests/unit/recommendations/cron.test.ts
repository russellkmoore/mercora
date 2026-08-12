import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecommendationRebuildSummary } from "@/lib/recommendations/batch/rebuild";

const mocks = vi.hoisted(() => ({ recordTelemetry: vi.fn() }));

vi.mock("@/lib/observability/telemetry", () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import { runRecommendationCron } from "@/lib/recommendations/cron";

const env = {} as CloudflareEnv;
const summary: RecommendationRebuildSummary = {
  catalogProducts: 2,
  productsAttempted: 2,
  productsDeferred: 0,
  productsProcessed: 2,
  productsSkipped: 0,
  rowsWritten: 2,
  errors: [],
  stalenessThresholdDays: 7,
  staleRowCount: 0,
  oldestGeneratedAt: null,
};

afterEach(() => vi.restoreAllMocks());

describe("runRecommendationCron", () => {
  it("rethrows rebuild failures so the scheduled execution fails", async () => {
    const rebuildError = new Error("offline");
    await expect(
      runRecommendationCron(env, vi.fn().mockRejectedValue(rebuildError)),
    ).rejects.toThrow("offline");
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "recommendation.rebuild_failed",
      expect.objectContaining({
        operation: "rebuild", outcome: "failed", retryable: true, trigger: "scheduled",
        duration_ms: expect.any(Number),
      }),
      rebuildError,
    );
  });

  it("treats partial product failures as a failed scheduled execution", async () => {
    await expect(
      runRecommendationCron(
        env,
        vi.fn().mockResolvedValue({
          ...summary,
          errors: [{ productId: "a", error: "bad vector" }],
        }),
      ),
    ).rejects.toThrow("1 product");
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "recommendation.rebuild_failed",
      expect.objectContaining({
        operation: "rebuild", outcome: "failed", retryable: true, trigger: "scheduled",
      }),
      expect.objectContaining({ message: expect.stringContaining("1 product") }),
    );
  });

  it("emits structured warnings for empty and stale rebuilds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runRecommendationCron(
      env,
      vi.fn().mockResolvedValue({ ...summary, rowsWritten: 0, staleRowCount: 2 }),
    );
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "recommendation.no_rows_written",
      expect.objectContaining({
        operation: "rebuild",
        count: 2,
        trigger: "scheduled",
      }),
    );
  });

  it("logs a structured success summary", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runRecommendationCron(env, vi.fn().mockResolvedValue(summary));
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      event: "recommendations.rebuild",
      outcome: "success",
      rowsWritten: 2,
    });
  });
});
