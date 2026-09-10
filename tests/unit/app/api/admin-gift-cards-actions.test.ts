import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  context: vi.fn(),
  resolveHonorEffective: vi.fn(),
  appendGiftCardEvent: vi.fn(),
  createGiftCardRepository: vi.fn(),
  resendGiftCardDelivery: vi.fn(),
  giftCardReissueId: vi.fn(),
  giftCardReissueDeliveryId: vi.fn(),
  generateGiftCardCode: vi.fn(),
  digestGiftCardCode: vi.fn(),
  giftCardCodeSuffix: vi.fn(),
  parseGiftCardCodeKeyRing: vi.fn(),
  parseGiftCardDeliveryKeyRing: vi.fn(),
  encryptGiftCardDeliveryCode: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));
vi.mock("@/lib/gift-cards/events", () => ({
  appendGiftCardEvent: mocks.appendGiftCardEvent,
}));
vi.mock("@/lib/gift-cards/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gift-cards/repository")>();
  return { ...actual, createGiftCardRepository: mocks.createGiftCardRepository };
});
vi.mock("@/lib/services/gift-card-fulfillment", () => ({
  resendGiftCardDelivery: mocks.resendGiftCardDelivery,
}));
vi.mock("@/lib/gift-cards/domain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gift-cards/domain")>();
  return {
    ...actual,
    giftCardReissueId: mocks.giftCardReissueId,
    giftCardReissueDeliveryId: mocks.giftCardReissueDeliveryId,
  };
});
vi.mock("@/lib/gift-cards/code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gift-cards/code")>();
  return {
    ...actual,
    generateGiftCardCode: mocks.generateGiftCardCode,
    digestGiftCardCode: mocks.digestGiftCardCode,
    giftCardCodeSuffix: mocks.giftCardCodeSuffix,
  };
});
vi.mock("@/lib/gift-cards/config", () => ({
  parseGiftCardCodeKeyRing: mocks.parseGiftCardCodeKeyRing,
  parseGiftCardDeliveryKeyRing: mocks.parseGiftCardDeliveryKeyRing,
}));
vi.mock("@/lib/gift-cards/encryption", () => ({
  encryptGiftCardDeliveryCode: mocks.encryptGiftCardDeliveryCode,
}));

import { POST as disable } from "@/app/api/admin/gift-cards/[id]/disable/route";
import { POST as notes } from "@/app/api/admin/gift-cards/[id]/notes/route";
import { POST as requeue } from "@/app/api/admin/gift-cards/[id]/requeue/route";
import { POST as releaseHold } from "@/app/api/admin/gift-cards/[id]/release-hold/route";
import { POST as resend } from "@/app/api/admin/gift-cards/[id]/resend/route";
import { POST as reissue } from "@/app/api/admin/gift-cards/[id]/reissue/route";
import {
  GiftCardConflictError,
  GiftCardUnavailableError,
} from "@/lib/gift-cards/repository";
import { Money } from "@/lib/money";

const context = { params: Promise.resolve({ id: "gift_card_1" }) };

function postRequest(path: string, body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(`https://store.test/api/admin/gift-cards/gift_card_1/${path}`, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(headers ? { headers } : {}),
  });
}

let repository: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkAdminPermissions.mockResolvedValue({
    success: true,
    userId: "user_admin",
    isServiceToken: false,
  });
  // Selling on: giftCardSurfacesHidden(flags) is false, so the honor gate is
  // skipped entirely and these action-route tests do not need to also drive
  // resolveHonorEffective — that predicate has its own dedicated contract.
  mocks.context.mockResolvedValue({
    env: { DB: {}, STORE_FEATURE_GIFT_CARD_ACQUISITION: "true" },
  });
  mocks.resolveHonorEffective.mockResolvedValue(true);
  mocks.appendGiftCardEvent.mockResolvedValue("event_1");
  mocks.giftCardReissueId.mockResolvedValue("gift_card_reissue_x");
  mocks.giftCardReissueDeliveryId.mockResolvedValue("gift_delivery_reissue_x");
  mocks.generateGiftCardCode.mockReturnValue("GC-2345-6789-2345-6789-2345-6789-2345");
  mocks.digestGiftCardCode.mockResolvedValue({ keyVersion: 1, digest: "a".repeat(64) });
  mocks.giftCardCodeSuffix.mockReturnValue("2345");
  mocks.parseGiftCardCodeKeyRing.mockReturnValue({});
  mocks.parseGiftCardDeliveryKeyRing.mockReturnValue({});
  mocks.encryptGiftCardDeliveryCode.mockResolvedValue({ keyVersion: 1, nonce: "n", ciphertext: "c" });
  repository = {
    disableAccount: vi.fn(),
    requeueDelivery: vi.fn(),
    findReservations: vi.fn(),
    releaseReservation: vi.fn(),
    findDeliveryByGiftCardId: vi.fn().mockResolvedValue({
      id: "gift_delivery_1",
      recipientEmail: "buyer@example.com",
    }),
    reissue: vi.fn(),
  };
  mocks.createGiftCardRepository.mockReturnValue(repository);
});

describe("POST /api/admin/gift-cards/[id]/disable", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Admin access required" });
    const response = await disable(postRequest("disable", { reason: "fraud" }), context);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    expect(repository.disableAccount).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized body and 400 for malformed JSON", async () => {
    const oversized = await disable(
      postRequest("disable", undefined, { "content-length": "5000" }),
      context,
    );
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: "request_too_large" });

    const malformed = await disable(
      new NextRequest("https://store.test/api/admin/gift-cards/gift_card_1/disable", {
        method: "POST",
        body: "{broken",
      }),
      context,
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "invalid_json" });
  });

  it("returns 400 invalid_body for a missing, empty, or over-long reason", async () => {
    for (const reason of [undefined, "", "x".repeat(501)]) {
      const response = await disable(postRequest("disable", { reason }), context);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalid_body" });
    }
    expect(repository.disableAccount).not.toHaveBeenCalled();
  });

  it("returns 404 gift_card_not_found for an unknown card id", async () => {
    repository.disableAccount.mockRejectedValue(new GiftCardUnavailableError("Gift card is unavailable"));
    const response = await disable(postRequest("disable", { reason: "fraud" }), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "gift_card_not_found" });
  });

  it("returns 409 and writes no event for an already-disabled card", async () => {
    repository.disableAccount.mockResolvedValue({
      changed: false,
      account: { id: "gift_card_1", status: "disabled", disabledAt: 1_700_000_000 },
    });
    const response = await disable(postRequest("disable", { reason: "fraud" }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "gift_card_already_disabled" });
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("writes exactly one disabled event carrying the reason and the calling admin, and returns no code material", async () => {
    repository.disableAccount.mockResolvedValue({
      changed: true,
      account: { id: "gift_card_1", status: "disabled", disabledAt: 1_700_000_000 },
    });
    const response = await disable(postRequest("disable", { reason: "customer requested" }), context);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "disabled", disabledAt: 1_700_000_000 });
    expect(body).not.toHaveProperty("code");
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledTimes(1);
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        giftCardId: "gift_card_1",
        eventType: "disabled",
        actor: { type: "admin", id: "user_admin" },
        details: { reason: "customer requested" },
      }),
    );
  });

  it("returns 503 gift_cards_write_failed on a repository failure", async () => {
    repository.disableAccount.mockRejectedValue(new Error("D1 unavailable"));
    const response = await disable(postRequest("disable", { reason: "fraud" }), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "gift_cards_write_failed" });
  });
});

describe("POST /api/admin/gift-cards/[id]/notes", () => {
  it("writes a note event for text within bounds", async () => {
    const response = await notes(postRequest("notes", { text: "Called customer, confirmed identity." }), context);
    expect(response.status).toBe(200);
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        giftCardId: "gift_card_1",
        eventType: "note",
        actor: { type: "admin", id: "user_admin" },
        details: { text: "Called customer, confirmed identity." },
      }),
    );
  });

  it("returns 400 for empty or over-long text", async () => {
    for (const text of ["", "x".repeat(2_001)]) {
      const response = await notes(postRequest("notes", { text }), context);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalid_body" });
    }
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 401 unauthenticated, 413 oversized, and 503 on write failure", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "no" });
    expect((await notes(postRequest("notes", { text: "hi" }), context)).status).toBe(401);

    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "user_admin" });
    expect(
      (await notes(postRequest("notes", undefined, { "content-length": "5000" }), context)).status,
    ).toBe(413);

    mocks.appendGiftCardEvent.mockRejectedValue(new Error("D1 unavailable"));
    const failed = await notes(postRequest("notes", { text: "hi" }), context);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ code: "gift_cards_write_failed" });
  });
});

describe("POST /api/admin/gift-cards/[id]/requeue", () => {
  it("moves a needs_review delivery to pending and writes one delivery_requeued event", async () => {
    repository.requeueDelivery.mockResolvedValue({ requeued: true, deliveryId: "gift_delivery_1" });
    const response = await requeue(postRequest("requeue"), context);
    expect(response.status).toBe(200);
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        giftCardId: "gift_card_1",
        eventType: "delivery_requeued",
        details: { delivery_id: "gift_delivery_1" },
      }),
    );
  });

  it("returns 409 delivery_not_requeueable and writes no event for any other delivery status", async () => {
    repository.requeueDelivery.mockResolvedValue({ requeued: false, deliveryId: undefined });
    const response = await requeue(postRequest("requeue"), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "delivery_not_requeueable" });
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 401 unauthenticated and 413 oversized", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "no" });
    expect((await requeue(postRequest("requeue"), context)).status).toBe(401);

    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "user_admin" });
    expect(
      (await requeue(postRequest("requeue", undefined, { "content-length": "5000" }), context)).status,
    ).toBe(413);
  });
});

describe("POST /api/admin/gift-cards/[id]/release-hold", () => {
  const openReservation = {
    id: "res_1",
    giftCardId: "gift_card_1",
    amount: { toMinorUnits: () => 500 },
    releasedAt: undefined,
    committedAt: undefined,
    expiresAt: 9_999_999_999,
    settled: false,
  };

  it("releases an open reservation and writes one hold_released event with the reservation id and amount", async () => {
    repository.findReservations.mockResolvedValue([openReservation]);
    repository.releaseReservation.mockResolvedValue({ released: true, reservation: openReservation });
    const response = await releaseHold(postRequest("release-hold", { reservationId: "res_1" }), context);
    expect(response.status).toBe(200);
    expect(repository.releaseReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "res_1", reason: "admin:user_admin" }),
    );
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        giftCardId: "gift_card_1",
        eventType: "hold_released",
        details: { reservation_id: "res_1", amount_minor: 500 },
      }),
    );
  });

  it("returns 409 reservation_not_releasable and writes no event for a committed-unsettled reservation", async () => {
    repository.findReservations.mockResolvedValue([
      { ...openReservation, committedAt: 1_700_000_000, expiresAt: undefined },
    ]);
    const response = await releaseHold(postRequest("release-hold", { reservationId: "res_1" }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "reservation_not_releasable" });
    expect(repository.releaseReservation).not.toHaveBeenCalled();
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 409 for an absent or foreign reservation id", async () => {
    repository.findReservations.mockResolvedValue([]);
    const response = await releaseHold(postRequest("release-hold", { reservationId: "res_missing" }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "reservation_not_releasable" });
  });
});

describe("POST /api/admin/gift-cards/[id]/resend", () => {
  beforeEach(() => {
    repository.findDeliveryByGiftCardId = vi.fn().mockResolvedValue({
      id: "gift_delivery_1",
      recipientEmail: "buyer@example.com",
    });
  });

  it("resends to the original recipient and writes one delivery_resent event, with an idempotency key naming both the delivery id and the new event id", async () => {
    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: true });
    const response = await resend(postRequest("resend", {}), context);
    expect(response.status).toBe(200);
    const call = mocks.resendGiftCardDelivery.mock.calls[0][0];
    expect(call.deliveryId).toBe("gift_delivery_1");
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledTimes(1);
    const eventCall = mocks.appendGiftCardEvent.mock.calls[0][0];
    expect(eventCall.eventType).toBe("delivery_resent");
    expect(eventCall.details).toEqual({ to: "buyer@example.com" });
    expect(call.idempotencyKey).toBe(`gift-card-resend/gift_delivery_1/${eventCall.id}`);
  });

  it("sends to an admin-supplied address and records it on the event", async () => {
    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: true });
    const response = await resend(postRequest("resend", { to: "fraud-recovery@example.com" }), context);
    expect(response.status).toBe(200);
    expect(mocks.resendGiftCardDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fraud-recovery@example.com" }),
    );
    expect(mocks.appendGiftCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({ details: { to: "fraud-recovery@example.com" } }),
    );
  });

  it("passes the full worker environment from getCloudflareContext, never a DB-only object", async () => {
    mocks.context.mockResolvedValue({
      env: {
        DB: {},
        STORE_FEATURE_GIFT_CARD_ACQUISITION: "true",
        EMAIL: { send: () => {} },
        EMAIL_PROVIDER: "cloudflare",
      },
    });
    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: true });
    await resend(postRequest("resend", {}), context);
    const call = mocks.resendGiftCardDelivery.mock.calls[0][0];
    expect(call.environment).toMatchObject({ EMAIL_PROVIDER: "cloudflare" });
  });

  it("maps not_resendable and code_unavailable to 409, and send_failed to 503", async () => {
    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: false, reason: "not_resendable" });
    expect((await resend(postRequest("resend", {}), context)).status).toBe(409);

    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: false, reason: "code_unavailable" });
    expect((await resend(postRequest("resend", {}), context)).status).toBe(409);

    mocks.resendGiftCardDelivery.mockResolvedValue({ sent: false, reason: "send_failed" });
    expect((await resend(postRequest("resend", {}), context)).status).toBe(503);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 404 delivery_not_found when the card has no delivery row", async () => {
    repository.findDeliveryByGiftCardId.mockResolvedValue(undefined);
    const response = await resend(postRequest("resend", {}), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "delivery_not_found" });
    expect(mocks.resendGiftCardDelivery).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_body for a malformed admin-supplied address", async () => {
    const response = await resend(postRequest("resend", { to: "not-an-email" }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_body" });
    expect(mocks.resendGiftCardDelivery).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/gift-cards/[id]/reissue", () => {
  it("drains a disabled card to a new card for the same amount, delivered to the original recipient, with the actor handed to the repository's single batch (CR-01, WR-01)", async () => {
    repository.reissue.mockResolvedValue({
      created: true,
      newGiftCardId: "gift_card_reissue_x",
      amount: Money.fromMinor(1_500, "USD"),
    });
    const response = await reissue(postRequest("reissue", {}), context);
    expect(response.status).toBe(200);
    const bodyOut = await response.json();
    expect(bodyOut).toMatchObject({ status: "reissued", newGiftCardId: "gift_card_reissue_x", amountMinor: 1_500 });

    expect(repository.reissue).toHaveBeenCalledWith(
      expect.objectContaining({
        oldGiftCardId: "gift_card_1",
        actor: { type: "admin", id: "user_admin" },
        delivery: expect.objectContaining({ recipientEmail: "buyer@example.com" }),
      }),
    );
    // The `reissued`/`reissued_from` rows land inside the repository's batch,
    // in the same transaction as the drain and the issuance — the route must
    // not append them afterwards on a separate connection.
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("delivers to an admin-supplied address instead", async () => {
    repository.reissue.mockResolvedValue({
      created: true,
      newGiftCardId: "gift_card_reissue_x",
      amount: Money.fromMinor(1_500, "USD"),
    });
    await reissue(postRequest("reissue", { to: "fraud-recovery@example.com" }), context);
    expect(repository.reissue).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery: expect.objectContaining({ recipientEmail: "fraud-recovery@example.com" }),
      }),
    );
  });

  it("returns 409 gift_card_reissue_blocked naming the reason for an active card, and writes nothing", async () => {
    repository.reissue.mockRejectedValue(
      new GiftCardConflictError("Gift card must be disabled before it can be reissued"),
    );
    const response = await reissue(postRequest("reissue", {}), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "gift_card_reissue_blocked",
      error: "Gift card must be disabled before it can be reissued",
    });
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 409 gift_card_reissue_blocked for a blocked reservation, and writes nothing", async () => {
    repository.reissue.mockRejectedValue(
      new GiftCardConflictError("Gift card cannot be reissued while a reservation is open"),
    );
    const response = await reissue(postRequest("reissue", {}), context);
    expect(response.status).toBe(409);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 404 gift_card_not_found for an unknown card", async () => {
    repository.reissue.mockRejectedValue(new GiftCardUnavailableError("Gift card is unavailable"));
    const response = await reissue(postRequest("reissue", {}), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "gift_card_not_found" });
  });

  it("returns 409 on a second reissue attempt and writes nothing", async () => {
    repository.reissue.mockRejectedValue(
      new GiftCardConflictError("Gift card has no available balance to reissue"),
    );
    const response = await reissue(postRequest("reissue", {}), context);
    expect(response.status).toBe(409);
    expect(mocks.appendGiftCardEvent).not.toHaveBeenCalled();
  });

  it("returns 401 unauthenticated and 400 for an invalid admin-supplied address", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "no" });
    expect((await reissue(postRequest("reissue", {}), context)).status).toBe(401);

    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "user_admin" });
    const response = await reissue(postRequest("reissue", { to: "not-an-email" }), context);
    expect(response.status).toBe(400);
    expect(repository.reissue).not.toHaveBeenCalled();
  });
});
