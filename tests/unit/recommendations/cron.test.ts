import { afterEach, describe, expect, it, vi } from "vitest";
import { runRecommendationCron } from "@/lib/recommendations/cron";
import type { RecommendationRebuildSummary } from "@/lib/recommendations/batch/rebuild";

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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      runRecommendationCron(env, vi.fn().mockRejectedValue(new Error("offline"))),
    ).rejects.toThrow("offline");
  });

  it("treats partial product failures as a failed scheduled execution", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      runRecommendationCron(
        env,
        vi.fn().mockResolvedValue({
          ...summary,
          errors: [{ productId: "a", error: "bad vector" }],
        }),
      ),
    ).rejects.toThrow("1 product");
  });

  it("emits structured warnings for empty and stale rebuilds", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runRecommendationCron(
      env,
      vi.fn().mockResolvedValue({ ...summary, rowsWritten: 0, staleRowCount: 2 }),
    );
    expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
      event: "recommendations.rebuild",
      outcome: "no_rows_written",
      staleRowCount: 2,
    });
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
