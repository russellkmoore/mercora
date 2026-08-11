import { describe, expect, it } from "vitest";
import {
  MAX_ORDERS,
  MAX_USER_CONTEXT_LENGTH,
  selectRecentOrders,
} from "@/lib/agent-chat-limits";

const order = (id: string, created_at?: string) => ({ id, created_at });

describe("selectRecentOrders", () => {
  it("bounds a history the chat route would otherwise reject", () => {
    const orders = Array.from({ length: 9 }, (_, i) =>
      order(`o${i}`, `2026-01-0${(i % 9) + 1}T00:00:00.000Z`),
    );
    expect(selectRecentOrders(orders)).toHaveLength(MAX_ORDERS);
  });

  it("keeps the newest orders", () => {
    const selected = selectRecentOrders([
      order("old", "2024-01-01T00:00:00.000Z"),
      order("newest", "2026-08-01T00:00:00.000Z"),
      order("mid", "2025-06-01T00:00:00.000Z"),
      order("oldest", "2023-01-01T00:00:00.000Z"),
    ]);
    expect(selected.map(({ id }) => id)).toEqual(["newest", "mid", "old"]);
  });

  it("sorts undated orders last rather than letting them displace known-recent ones", () => {
    const selected = selectRecentOrders([
      order("undated"),
      order("a", "2026-01-01T00:00:00.000Z"),
      order("b", "2026-02-01T00:00:00.000Z"),
      order("c", "2026-03-01T00:00:00.000Z"),
    ]);
    expect(selected.map(({ id }) => id)).toEqual(["c", "b", "a"]);
  });

  it("treats an unparseable timestamp as undated", () => {
    const selected = selectRecentOrders([
      order("bogus", "not-a-date"),
      order("real", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(selected[0].id).toBe("real");
  });

  it("does not mutate the caller's array", () => {
    const orders = [order("a", "2024-01-01T00:00:00.000Z"), order("b", "2026-01-01T00:00:00.000Z")];
    selectRecentOrders(orders);
    expect(orders.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("handles fewer orders than the bound", () => {
    expect(selectRecentOrders([order("only", "2026-01-01T00:00:00.000Z")])).toHaveLength(1);
  });
});

describe("shared bounds", () => {
  it("exposes the values the chat route enforces", () => {
    expect(MAX_ORDERS).toBe(3);
    expect(MAX_USER_CONTEXT_LENGTH).toBe(1_000);
  });
});
