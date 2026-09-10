import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  isSuperAdminActor: vi.fn(),
  context: vi.fn(),
  getSettings: vi.fn(),
  resolveHonorEffective: vi.fn(),
  appendGiftCardEvent: vi.fn(),
  giftCardDeliveryHasStoredCode: vi.fn(),
  revealGiftCardDeliveryCode: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
  isSuperAdminActor: mocks.isSuperAdminActor,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
vi.mock("@/lib/utils/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));
vi.mock("@/lib/gift-cards/events", () => ({
  appendGiftCardEvent: mocks.appendGiftCardEvent,
}));
vi.mock("@/lib/services/gift-card-fulfillment", () => ({
  giftCardDeliveryHasStoredCode: mocks.giftCardDeliveryHasStoredCode,
  revealGiftCardDeliveryCode: mocks.revealGiftCardDeliveryCode,
}));

import { POST as reveal } from "@/app/api/admin/gift-cards/[id]/reveal/route";

const context = { params: Promise.resolve({ id: "gift_card_1" }) };

function revealRequest(body?: unknown, headers?: Record<string, string>) {
  return new NextRequest("https://store.test/api/admin/gift-cards/gift_card_1/reveal", {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(headers ? { headers } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkAdminPermissions.mockResolvedValue({
    success: true,
    userId: "user_super_admin",
    isServiceToken: false,
    isDevMode: false,
  });
  mocks.isSuperAdminActor.mockResolvedValue(true);
  mocks.context.mockResolvedValue({
    env: { DB: {}, STORE_FEATURE_GIFT_CARD_ACQUISITION: "true" },
  });
  mocks.getSettings.mockResolvedValue({ "gift_cards.code_reveal_enabled": true });
  mocks.resolveHonorEffective.mockResolvedValue(true);
  mocks.appendGiftCardEvent.mockResolvedValue("event_1");
  mocks.giftCardDeliveryHasStoredCode.mockResolvedValue(true);
  mocks.revealGiftCardDeliveryCode.mockResolvedValue("GC-2345-6789-2345-6789-2345-6789-2345");
});

describe("POST /api/admin/gift-cards/[id]/reveal", () => {
  it("refuses with the setting off, regardless of who calls", async () => {
    mocks.getSettings.mockResolvedValue({ "gift_cards.code_reveal_enabled": false });
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "code_reveal_disabled" });
    expect(mocks.isSuperAdminActor).not.toHaveBeenCalled();
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("refuses with the setting missing entirely (a missing key is off)", async () => {
    mocks.getSettings.mockResolvedValue({});
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "code_reveal_disabled" });
  });

  it("refuses a non-super-admin caller with the setting on, and writes no event", async () => {
    mocks.isSuperAdminActor.mockResolvedValue(false);
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden" });
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("refuses a service-token caller even with the setting on", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({
      success: true,
      userId: "admin-service",
      isServiceToken: true,
    });
    // isSuperAdminActor already returns false for a service token in the real
    // implementation; the mock here proves the route honors that refusal.
    mocks.isSuperAdminActor.mockResolvedValue(false);
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(403);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("refuses the development bypass even with the setting on", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({
      success: true,
      userId: "dev-admin",
      isDevMode: true,
    });
    mocks.isSuperAdminActor.mockResolvedValue(false);
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(403);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 400 without { confirm: true }, and writes no event", async () => {
    const missing = await reveal(revealRequest({}), context);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "invalid_body" });

    const falseConfirm = await reveal(revealRequest({ confirm: false }), context);
    expect(falseConfirm.status).toBe(400);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 409 code_unavailable for a card whose delivery has no ciphertext", async () => {
    mocks.giftCardDeliveryHasStoredCode.mockResolvedValue(false);
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "code_unavailable" });
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
    expect(mocks.revealGiftCardDeliveryCode).not.toHaveBeenCalled();
  });

  it("writes the code_revealed event before decrypting, and returns no code when the event write throws", async () => {
    mocks.appendGiftCardEvent.mockRejectedValue(new Error("D1 unavailable"));
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(503);
    const body = await response.json();
    // The response's own error envelope always carries a `code` field (e.g.
    // "gift_cards_write_failed") — what must be absent is the bearer code
    // itself, which is never a bare "GC-..." value anywhere in the body.
    expect(JSON.stringify(body)).not.toContain("GC-");
    expect(mocks.revealGiftCardDeliveryCode).not.toHaveBeenCalled();
  });

  it("returns the code with a no-store cache header on success, after writing the event first", async () => {
    const calls: string[] = [];
    mocks.appendGiftCardEvent.mockImplementation(async () => {
      calls.push("event");
      return "event_1";
    });
    mocks.revealGiftCardDeliveryCode.mockImplementation(async () => {
      calls.push("decrypt");
      return "GC-2345-6789-2345-6789-2345-6789-2345";
    });
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(200);
    expect(calls).toEqual(["event", "decrypt"]);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ code: "GC-2345-6789-2345-6789-2345-6789-2345" });
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({ giftCardId: "gift_card_1", eventType: "code_revealed" }),
    );
    // No code material anywhere in the event details.
    const eventArgs = mocks.appendGiftCardEvent.mock.calls[0][0];
    expect(JSON.stringify(eventArgs.details ?? {})).not.toContain("GC-");
  });

  it("returns 401 for an unauthenticated caller", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "no" });
    const response = await reveal(revealRequest({ confirm: true }), context);
    expect(response.status).toBe(401);
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });
});
