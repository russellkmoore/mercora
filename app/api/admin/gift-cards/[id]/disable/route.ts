import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
  jsonError,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";
import { assertGiftCardReason } from "@/lib/gift-cards/domain";
import { appendGiftCardEvent } from "@/lib/gift-cards/events";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import {
  GiftCardUnavailableError,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";

/**
 * D-05/D-13: disable a card with a required reason. The archetype every
 * other route in this plan follows: auth, actor, bounded body, honor gate,
 * validation, one repository call, one audit event, a typed response
 * (T-14-38).
 *
 * There is no re-enable route and none is to be added — the 0022 status
 * transition guard forbids disabled -> active, and D-05 says the answer to a
 * mistaken disable is a reissue.
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

  // D-16: `giftCardSurfacesHidden` plus a direct call to `resolveHonorEffective`
  // — the single owner of the existence decision — never a re-derivation.
  const flags = giftCardAdminFlags(environment);
  if (giftCardSurfacesHidden(flags)) {
    const nowSeconds = Math.floor(Date.now() / 1_000);
    const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
    if (!guardActive) {
      return jsonError("gift_cards_unavailable", "Gift cards are not available", 404);
    }
  }

  const body = bodyResult.body;
  const reason = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).reason
    : undefined;
  try {
    assertGiftCardReason(reason, "gift-card disable reason", 500);
  } catch {
    return jsonError(
      "invalid_body",
      "A disable reason between 1 and 500 characters is required",
      400,
    );
  }

  const repository = createGiftCardRepository(environment.DB);
  const now = Math.floor(Date.now() / 1_000);
  try {
    const result = await repository.disableAccount({ giftCardId: id, disabledAt: now });
    if (!result.changed) {
      return jsonError("gift_card_already_disabled", "Gift card is already disabled", 409);
    }
    await appendGiftCardEvent({
      giftCardId: id,
      eventType: "disabled",
      actor,
      details: { reason },
      createdAt: now,
    });
    return NextResponse.json({ status: "disabled", disabledAt: result.account.disabledAt ?? now });
  } catch (error) {
    if (error instanceof GiftCardUnavailableError) {
      return jsonError("gift_card_not_found", "Gift card not found", 404);
    }
    return jsonError("gift_cards_write_failed", "Failed to disable gift card", 503);
  }
}
