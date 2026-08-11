import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_ORDERS,
  MAX_USER_CONTEXT_LENGTH,
  selectRecentHistory,
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

describe("selectRecentHistory", () => {
  const turn = (i: number, content = `m${i}`) => ({ role: "user", content });

  it("bounds a conversation the chat route would otherwise reject", () => {
    const messages = Array.from({ length: 30 }, (_, i) => turn(i));
    expect(selectRecentHistory(messages)).toHaveLength(MAX_HISTORY_MESSAGES);
  });

  it("keeps the latest turns, not the earliest", () => {
    const messages = Array.from({ length: 15 }, (_, i) => turn(i));
    const selected = selectRecentHistory(messages);
    expect(selected[0].content).toBe("m3");
    expect(selected[selected.length - 1].content).toBe("m14");
  });

  it("trims a turn longer than the route accepts", () => {
    const long = turn(0, "x".repeat(MAX_HISTORY_CONTENT_LENGTH + 500));
    expect(selectRecentHistory([long])[0].content).toHaveLength(MAX_HISTORY_CONTENT_LENGTH);
  });

  it("leaves short turns untouched", () => {
    const messages = [turn(0, "hello")];
    expect(selectRecentHistory(messages)[0]).toBe(messages[0]);
  });

  it("handles an empty conversation", () => {
    expect(selectRecentHistory([])).toEqual([]);
  });
});

describe("shared bounds", () => {
  it("exposes the values the chat route enforces", () => {
    expect(MAX_ORDERS).toBe(3);
    expect(MAX_USER_CONTEXT_LENGTH).toBe(1_000);
  });
});
