import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import { giftCardAdminFlags, jsonError } from "@/lib/gift-cards/admin-http";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import { getAdminGiftCardPresentation } from "@/lib/gift-cards/presentations";
import {
  classifyGiftCardReservation,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import { getSettings } from "@/lib/utils/settings";

/**
 * D-13: a card's full admin view — id, masked code, balances, delivery,
 * recipient, purchaser, and every reservation classified. Every field is
 * built one at a time from `findAccountById`/`getAdminGiftCardPresentation`/
 * `findReservations`, never a spread of an account or delivery row (D-14).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return jsonError("unauthorized", auth.error ?? "Admin access required", 401);
  }

  const { id } = await params;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error("D1 binding unavailable");

    // D-16: `giftCardSurfacesHidden` plus a direct call to
    // `resolveHonorEffective` — the single owner of the existence decision —
    // the same way `app/api/admin/gift-cards/route.ts` already does.
    const flags = giftCardAdminFlags(environment);
    const nowSeconds = Math.floor(Date.now() / 1_000);
    if (giftCardSurfacesHidden(flags)) {
      const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
      if (!guardActive) {
        return jsonError("gift_cards_unavailable", "Gift cards are not available", 404);
      }
    }

    const repository = createGiftCardRepository(environment.DB);
    const account = await repository.findAccountById(id);
    if (!account) {
      return jsonError("gift_card_not_found", "Gift card not found", 404);
    }

    const presentation = await getAdminGiftCardPresentation(environment.DB, id, nowSeconds);
    if (!presentation) {
      // The account just resolved above; a missing presentation row here is a
      // data-integrity surprise, not a legitimate "not found" — falls to the
      // 503 catch rather than masquerading as a 404.
      throw new Error("Gift-card presentation projection is missing for an existing account");
    }

    const reservations = await repository.findReservations(id);
    const settings = await getSettings("gift_cards");
    // IN-07: the reveal control only appears for a caller the reveal route
    // would actually accept — setting on AND a super-admin browser session
    // (service tokens and the dev bypass are refused there). Anyone else
    // would only get a 403 toast for their click.
    const codeRevealEnabled = settings["gift_cards.code_reveal_enabled"] === true
      && await isSuperAdminActor(auth);

    return NextResponse.json({
      card: {
        id: presentation.id,
        maskedCode: presentation.maskedCode,
        codeSuffix: presentation.codeSuffix ?? null,
        issuedAmount: presentation.issuedAmount,
        availableBalance: presentation.availableBalance,
        status: presentation.status,
        createdAt: presentation.createdAt,
        disabledAt: account.disabledAt ?? null,
        issuedOrderId: presentation.issuedOrderId ?? null,
        recipientEmail: presentation.recipientEmail ?? null,
        purchaser: presentation.purchaser ?? null,
        delivery: presentation.delivery ?? null,
      },
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        amountMinor: reservation.amount.toMinorUnits(),
        reservedAt: reservation.reservedAt,
        expiresAt: reservation.expiresAt,
        committedOrderId: reservation.committedOrderId ?? null,
        committedAt: reservation.committedAt ?? null,
        releasedAt: reservation.releasedAt ?? null,
        releaseReason: reservation.releaseReason ?? null,
        classification: classifyGiftCardReservation(reservation, nowSeconds),
      })),
      // D-12: read-only here — the UI's reveal control and the reveal
      // route's own gate both read this same stored setting and the same
      // super-admin check.
      capabilities: { codeRevealEnabled },
    });
  } catch {
    return jsonError("gift_cards_read_failed", "Gift cards are temporarily unavailable", 503);
  }
}
