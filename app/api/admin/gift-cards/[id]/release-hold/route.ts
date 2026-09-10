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
import { appendGiftCardEvent } from "@/lib/gift-cards/events";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import {
  classifyGiftCardReservation,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";

/**
 * D-10/D-13: release a stuck, open (uncommitted, unexpired) reservation.
 * Committed-unsettled reservations are explicitly not releasable here — the
 * timeline shows them as awaiting settlement.
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
  const reservationId = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).reservationId
    : undefined;
  if (typeof reservationId !== "string" || reservationId.length === 0) {
    return jsonError("invalid_body", "A reservationId is required", 400);
  }

  const repository = createGiftCardRepository(environment.DB);
  const now = Math.floor(Date.now() / 1_000);
  try {
    const reservations = await repository.findReservations(id);
    const reservation = reservations.find((candidate) => candidate.id === reservationId);
    const classification = reservation ? classifyGiftCardReservation(reservation, now) : undefined;
    if (!reservation || reservation.giftCardId !== id || classification !== "open") {
      return jsonError("reservation_not_releasable", "Reservation is not releasable", 409);
    }

    const released = await repository.releaseReservation({
      reservationId,
      reason: `admin:${actor.id ?? "unknown"}`,
      releasedAt: now,
    });
    await appendGiftCardEvent({
      giftCardId: id,
      eventType: "hold_released",
      actor,
      details: {
        reservation_id: reservationId,
        amount_minor: released.reservation.amount.toMinorUnits(),
      },
      createdAt: now,
    });
    return NextResponse.json({ status: "released", reservationId });
  } catch {
    return jsonError("gift_cards_write_failed", "Failed to release gift-card hold", 503);
  }
}
