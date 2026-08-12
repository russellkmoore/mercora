import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as Array<{ id: string; primary: unknown; media: unknown }>, where: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: mocks.where }) }),
  })),
}));

import { resolveOrderLineImages } from "@/lib/services/order-confirmation";

beforeEach(() => {
  mocks.rows = [];
  mocks.where.mockReset().mockImplementation(async () => mocks.rows);
});

describe("order confirmation catalog image hydration", () => {
  it("uses one deduplicated lookup and resolves primary/media shapes", async () => {
    mocks.rows = [
      { id: "product-a", primary: JSON.stringify({ url: "/a.png" }), media: null },
      { id: "product-b", primary: null, media: JSON.stringify([{ url: "/b.png" }]) },
    ];
    const images = await resolveOrderLineImages(["product-a", "product-a", "product-b"]);
    expect(mocks.where).toHaveBeenCalledOnce();
    expect([...images]).toEqual([["product-a", "/a.png"], ["product-b", "/b.png"]]);
  });

  it("bounds identifiers and degrades without blocking confirmation", async () => {
    mocks.where.mockRejectedValueOnce(new Error("catalog unavailable"));
    await expect(resolveOrderLineImages(Array.from({ length: 500 }, (_, i) => `product-${i}`)))
      .resolves.toEqual(new Map());
    expect(mocks.where).toHaveBeenCalledOnce();
  });
});
