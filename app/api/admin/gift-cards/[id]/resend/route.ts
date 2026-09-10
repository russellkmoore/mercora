import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
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
  const delivery = await repository.findDeliveryByGiftCardId(id);
  if (!delivery) {
    return jsonError("delivery_not_found", "Gift card has no delivery to resend", 404);
  }

  const effectiveTo = to ?? delivery.recipientEmail;
  const eventId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1_000);
  try {
    const result = await resendGiftCardDelivery({
      deliveryId: delivery.id,
      to,
      idempotencyKey: `gift-card-resend/${delivery.id}/${eventId}`,
      environment,
      now,
    });
    if (!result.sent) {
      if (result.reason === "not_resendable") {
        return jsonError("delivery_not_resendable", "Delivery is not resendable", 409);
      }
      if (result.reason === "code_unavailable") {
        return jsonError("code_unavailable", "Gift-card code is unavailable", 409);
      }
      return jsonError("gift_cards_write_failed", "Failed to resend gift-card delivery", 503);
    }
    await appendGiftCardEvent({
      id: eventId,
      giftCardId: id,
      eventType: "delivery_resent",
      actor,
      details: { to: effectiveTo },
      createdAt: now,
    });
    return NextResponse.json({ status: "sent", to: effectiveTo });
  } catch {
    return jsonError("gift_cards_write_failed", "Failed to resend gift-card delivery", 503);
  }
}
