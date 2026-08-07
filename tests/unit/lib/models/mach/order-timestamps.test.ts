import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn();
const updateSet = vi.fn();

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ORD-TEST-1",
    customer_id: "cus_1",
    status: "pending",
    total_amount: { amount: 2500, currency: "USD" },
    currency_code: "USD",
    shipping_address: null,
    billing_address: null,
    items: [],
    shipping_method: null,
    shipping_carrier: null,
    payment_method: null,
    payment_status: "pending",
    notes: null,
    external_references: null,
    extensions: null,
    shipped_at: null,
    delivered_at: null,
    tracking_number: null,
    created_at: "2026-08-06T12:34:56.789Z",
    updated_at: "2026-08-06T12:34:56.789Z",
    ...overrides,
  };
}

vi.mock("@/lib/db", () => ({
  getDbAsync: vi.fn(async () => ({
    insert: () => ({
      values: (record: Record<string, unknown>) => {
        insertValues(record);
        return { returning: async () => [makeRow(record)] };
      },
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        updateSet(patch);
        return {
          where: () => ({ returning: async () => [makeRow(patch)] }),
        };
      },
    }),
  })),
}));

const orderInput = {
  customer_id: "cus_1",
  total_amount: { amount: 2500, currency: "USD" },
  currency_code: "USD",
  items: [],
} as never;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-06T12:34:56.789Z"));
  insertValues.mockClear();
  updateSet.mockClear();
});

describe("order timestamp writers", () => {
  it("creates an order with one explicit canonical ISO timestamp", async () => {
    const { createOrder } = await import("@/lib/models/mach/orders");
    await createOrder(orderInput);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: "2026-08-06T12:34:56.789Z",
        updated_at: "2026-08-06T12:34:56.789Z",
      }),
    );
  });

  it("uses the same instant for updated_at and an automatic shipped_at", async () => {
    const { updateOrderShipping } = await import("@/lib/models/mach/orders");
    await updateOrderShipping("ORD-TEST-1", { status: "shipped" });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "shipped",
        shipped_at: "2026-08-06T12:34:56.789Z",
        updated_at: "2026-08-06T12:34:56.789Z",
      }),
    );
  });

  it("writes ISO updated_at values for status changes and cancellation", async () => {
    const { cancelOrder, updateOrderStatus } = await import("@/lib/models/mach/orders");

    await updateOrderStatus("ORD-TEST-1", "processing");
    await cancelOrder("ORD-TEST-1", "customer request");

    expect(updateSet.mock.calls.map(([patch]) => patch.updated_at)).toEqual([
      "2026-08-06T12:34:56.789Z",
      "2026-08-06T12:34:56.789Z",
    ]);
  });
});
