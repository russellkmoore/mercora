import { describe, expect, it, vi } from "vitest";
import {
  rebuildWithAdapter,
  type RecommendationRebuildAdapter,
  type RebuildProduct,
} from "@/lib/recommendations/batch/rebuild";

const products: RebuildProduct[] = [
  { id: "a", name: "A", description: "", tags: [] },
  { id: "b", name: "B", description: "", tags: [] },
  { id: "c", name: "C", description: "", tags: [] },
];

function adapter(overrides: Partial<RecommendationRebuildAdapter> = {}) {
  const base: RecommendationRebuildAdapter = {
    countActiveProducts: vi.fn().mockResolvedValue(products.length),
    listActiveProducts: vi.fn().mockResolvedValue(products),
    embed: vi.fn().mockResolvedValue([0.1]),
    queryNeighbors: vi.fn().mockResolvedValue([{ id: "b", score: 0.9 }]),
    replaceRecommendations: vi.fn().mockResolvedValue(undefined),
    readStaleness: vi.fn().mockResolvedValue({ staleRowCount: 0, oldestGeneratedAt: null }),
  };
  return { ...base, ...overrides };
}

describe("rebuildWithAdapter", () => {
  it("preserves existing rows when no valid neighbors are returned", async () => {
    const current = adapter({
      queryNeighbors: vi.fn().mockResolvedValue([{ id: "missing", score: 1 }]),
    });
    const summary = await rebuildWithAdapter(current);
    expect(current.replaceRecommendations).not.toHaveBeenCalled();
    expect(summary.productsSkipped).toBe(3);
    expect(summary.rowsWritten).toBe(0);
  });

  it("filters self, inactive, and duplicate matches before atomic replacement", async () => {
    const current = adapter({
      queryNeighbors: vi.fn().mockResolvedValue([
        { id: "a", score: 1 },
        { id: "inactive", score: 0.99 },
        { id: "b", score: 0.9 },
        { id: "b", score: 0.8 },
        { id: "c", score: 0.7 },
      ]),
    });
    await rebuildWithAdapter(current, { neighbors: 2 });
    expect(current.replaceRecommendations).toHaveBeenCalledWith("a", [
      { id: "b", score: 0.9 },
      { id: "c", score: 0.7 },
    ]);
  });

  it("continues after a per-product failure and reports it", async () => {
    const current = adapter({
      embed: vi.fn(async (product: RebuildProduct) => {
        if (product.id === "b") throw new Error("embedding failed");
        return [0.1];
      }),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const summary = await rebuildWithAdapter(current);
    expect(summary.productsProcessed).toBe(2);
    expect(summary.errors).toEqual([{ productId: "b", error: "embedding failed" }]);
    error.mockRestore();
  });

  it("reports stale rows without failing completed writes", async () => {
    const current = adapter({
      readStaleness: vi.fn().mockResolvedValue({
        staleRowCount: 4,
        oldestGeneratedAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    const summary = await rebuildWithAdapter(current);
    expect(summary.staleRowCount).toBe(4);
    expect(summary.oldestGeneratedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("reports catalog products deferred by the bounded rebuild", async () => {
    const current = adapter({ countActiveProducts: vi.fn().mockResolvedValue(120) });
    const summary = await rebuildWithAdapter(current);
    expect(summary.catalogProducts).toBe(120);
    expect(summary.productsAttempted).toBe(3);
    expect(summary.productsDeferred).toBe(117);
  });
});
