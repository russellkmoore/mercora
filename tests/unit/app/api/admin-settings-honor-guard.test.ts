import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  isSuperAdminActor: vi.fn(),
  getDbAsync: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
  isSuperAdminActor: mocks.isSuperAdminActor,
}));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/settings/route";
import {
  HONOR_GUARD_SETTING_CATEGORY,
  HONOR_GUARD_SETTING_KEY,
} from "@/lib/gift-cards/honor-guard";

/**
 * The honor guard is the one `admin_settings` row that decides whether gift-card
 * balances keep being honored after the honor flag is turned off (D-15). The
 * cron writes it; nothing else may. This route accepts an arbitrary key from the
 * request body, so the only thing standing between an ordinary admin and a
 * forged zero measurement is an explicit rejection here (T-13-33).
 */
function settingsRequest(updates: unknown[]) {
  return new NextRequest("https://store.example.test/api/admin/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://store.example.test",
    },
    body: JSON.stringify({ updates }),
  });
}

const forgedMeasurement = {
  outstanding_minor: 0,
  currency: "USD",
  open_reservations: 0,
  measured_at: 1_900_000_000,
};

describe("the generic settings writer refuses the gift-card honor guard (CR-02, D-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
  });

  it("rejects a write naming the guard key, before touching the database", async () => {
    const response = await POST(settingsRequest([{
      key: HONOR_GUARD_SETTING_KEY,
      category: "system",
      data_type: "object",
      value: forgedMeasurement,
    }]));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "honor_guard_read_only" });
    // The row is unchanged because no write was ever attempted.
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("rejects a write naming the guard category even under a different key", async () => {
    const response = await POST(settingsRequest([{
      key: "gift_cards.something_else",
      category: HONOR_GUARD_SETTING_CATEGORY,
      data_type: "object",
      value: forgedMeasurement,
    }]));

    expect(response.status).toBe(400);
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when the guard is smuggled in beside a legitimate setting", async () => {
    const response = await POST(settingsRequest([
      { key: "store.free_shipping_threshold", category: "store", value: 5_000 },
      { key: HONOR_GUARD_SETTING_KEY, category: "gift_cards", value: forgedMeasurement },
    ]));

    expect(response.status).toBe(400);
    // Partial application would leave the honest half written and the caller
    // unsure which half landed.
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("still writes an ordinary setting that names neither the key nor the category", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: async () => undefined }),
      update: () => ({ set: () => ({ where }) }),
    };
    mocks.getDbAsync.mockResolvedValue({
      ...db,
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }))
        .mockImplementation(() => ({ from: () => ({ where: async () => [] }) })),
    });

    const response = await POST(settingsRequest([
      { key: "store.free_shipping_threshold", category: "store", value: 5_000 },
    ]));

    expect(response.status).toBe(200);
    expect(mocks.getDbAsync).toHaveBeenCalled();
  });
});
