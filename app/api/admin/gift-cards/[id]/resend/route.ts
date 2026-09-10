import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
  invalidGiftCardIdResponse,
  jsonError,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";
import { parseGiftCardCustomization } from "@/lib/gift-cards/customization";
import { appendGiftCardEvent } from "@/lib/gift-cards/events";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import { createGiftCardRepository } from "@/lib/gift-cards/repository";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import { resendGiftCardDelivery } from "@/lib/services/gift-card-fulfillment";

/**
 * D-08/D-13/D-21: re-send a `sent`/`needs_review` delivery's email, to the
 * original recipient or an admin-supplied address (fraud recovery). The
 * delivery row is never modified; the destination lands only on the event.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return jsonError("unauthorized", auth.error ?? "Unauthorized", 401);
  }
  const actor = actorFrom(auth);

  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.code, bodyResult.error, bodyResult.status);
  }

  const { id } = await params;
  const invalidId = invalidGiftCardIdResponse(id);
  if (invalidId) return invalidId;

  let environment: Record<string, unknown> & { DB?: D1Database };
  try {
    const { env } = await getCloudflareContext({ async: true });
    environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error("D1 binding unavailable");
  } catch {
    return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
  }

  const flags = giftCardAdminFlags(environment);
  if (giftCardSurfacesHidden(flags)) {
    const nowSeconds = Math.floor(Date.now() / 1_000);
    const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
    if (!guardActive) {
      return jsonError("gift_cards_unavailable", "Gift cards are not available", 404);
    }
  }

  const body = bodyResult.body;
  const rawTo = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).to
    : undefined;
  let to: string | undefined;
  if (rawTo !== undefined) {
    if (typeof rawTo !== "string") {
      return jsonError("invalid_body", "Recipient address must be a string", 400);
    }
    try {
      to = parseGiftCardCustomization({ recipientEmail: rawTo }).recipientEmail;
    } catch {
      return jsonError("invalid_body", "Recipient address is invalid", 400);
    }
  }

  const repository = createGiftCardRepository(environment.DB);
  // WR-06: a D1 failure on this read must be the typed 503 D-13 promises,
  // not an unhandled 500 the client renders as a bare "Request failed".
  let delivery: Awaited<ReturnType<typeof repository.findDeliveryByGiftCardId>>;
  try {
    delivery = await repository.findDeliveryByGiftCardId(id);
  } catch {
    return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
  }
  if (!delivery) {
    return jsonError("delivery_not_found", "Gift card has no delivery to resend", 404);
  }

  const effectiveTo = to ?? delivery.recipientEmail;
  const eventId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1_000);

  // A-2: audit the attempt and its destination BEFORE anything leaves the
  // building, the way reveal writes `code_revealed` before decrypting. A
  // fraud-recovery resend to a new address must be on the record even if the
  // provider call then fails or the worker dies mid-send — if this write
  // fails, nothing is sent. The pre-minted event id is what the sender's
  // idempotency key is built from (D-08), so the row and the key agree.
  try {
    await appendGiftCardEvent({
      id: eventId,
      giftCardId: id,
      eventType: "delivery_resent",
      actor,
      details: { to: effectiveTo },
      createdAt: now,
    });
  } catch {
    return jsonError("gift_cards_write_failed", "Failed to record the resend", 503);
  }

  // Best-effort: a failed audit write must not turn a failed send into a
  // different failure.
  const recordFailure = (reason: string) => appendGiftCardEvent({
    giftCardId: id,
    eventType: "delivery_resend_failed",
    actor,
    details: { to: effectiveTo, reason },
    createdAt: now,
  }).catch(() => undefined);

  try {
    const result = await resendGiftCardDelivery({
      deliveryId: delivery.id,
      to,
      idempotencyKey: `gift-card-resend/${delivery.id}/${eventId}`,
      environment,
      now,
    });
    if (!result.sent) {
      await recordFailure(result.reason);
      if (result.reason === "not_resendable") {
        return jsonError("delivery_not_resendable", "Delivery is not resendable", 409);
      }
      if (result.reason === "code_unavailable") {
        return jsonError("code_unavailable", "Gift-card code is unavailable", 409);
      }
      return jsonError("gift_cards_write_failed", "Failed to resend gift-card delivery", 503);
    }
    return NextResponse.json({ status: "sent", to: effectiveTo });
  } catch {
    await recordFailure("exception");
    return jsonError("gift_cards_write_failed", "Failed to resend gift-card delivery", 503);
  }
}
