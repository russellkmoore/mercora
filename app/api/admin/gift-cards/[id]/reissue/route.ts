import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
  jsonError,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";
import { digestGiftCardCode, generateGiftCardCode, giftCardCodeSuffix } from "@/lib/gift-cards/code";
import { parseGiftCardCodeKeyRing, parseGiftCardDeliveryKeyRing } from "@/lib/gift-cards/config";
import { parseGiftCardCustomization } from "@/lib/gift-cards/customization";
import { giftCardReissueDeliveryId, giftCardReissueId } from "@/lib/gift-cards/domain";
import { encryptGiftCardDeliveryCode } from "@/lib/gift-cards/encryption";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import {
  GiftCardConflictError,
  GiftCardUnavailableError,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";

/**
 * D-06/D-13/D-19: drain a disabled card's remaining balance into a new card,
 * once only. `repository.reissue` owns the status/reservation/balance checks
 * and writes the drain adjustment, the new card, its delivery row and the
 * paired `reissued`/`reissued_from` audit events in one D1 batch, so nothing
 * here runs after the money moves; this route only generates the new card's
 * bearer material the way `issueAdminGiftCard` does and hands the actor in
 * (T-14-44, T-14-45).
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
  // WR-06: the delivery read runs before the main try, so it needs its own
  // typed 503 rather than escaping as an unhandled 500.
  let recipientEmail = to;
  if (!recipientEmail) {
    try {
      recipientEmail = (await repository.findDeliveryByGiftCardId(id))?.recipientEmail;
    } catch {
      return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
    }
  }
  if (!recipientEmail) {
    return jsonError("invalid_body", "A recipient address is required", 400);
  }

  const now = Math.floor(Date.now() / 1_000);
  const newGiftCardId = await giftCardReissueId(id);
  const newDeliveryId = await giftCardReissueDeliveryId(id);
  const code = generateGiftCardCode();
  try {
    const codeHash = await digestGiftCardCode(code, parseGiftCardCodeKeyRing(environment));
    if (!codeHash) throw new Error("Generated gift-card code is invalid");
    const encrypted = await encryptGiftCardDeliveryCode({
      giftCardId: newGiftCardId,
      deliveryId: newDeliveryId,
      code,
      keyRing: parseGiftCardDeliveryKeyRing(environment),
    });

    const result = await repository.reissue({
      oldGiftCardId: id,
      now,
      actor,
      codeHash,
      codeSuffix: giftCardCodeSuffix(code) ?? undefined,
      delivery: {
        id: newDeliveryId,
        recipientEmail,
        emailIdempotencyKey: `gift-card-delivery/${newGiftCardId}/v1`,
        codeCiphertext: encrypted.ciphertext,
        codeNonce: encrypted.nonce,
        codeKeyVersion: encrypted.keyVersion,
      },
    });

    return NextResponse.json({
      status: "reissued",
      newGiftCardId: result.newGiftCardId,
      amountMinor: result.amount.toMinorUnits(),
    });
  } catch (error) {
    if (error instanceof GiftCardUnavailableError) {
      return jsonError("gift_card_not_found", "Gift card not found", 404);
    }
    if (error instanceof GiftCardConflictError) {
      return jsonError("gift_card_reissue_blocked", error.message, 409);
    }
    return jsonError("gift_cards_write_failed", "Failed to reissue gift card", 503);
  } finally {
    // Strings cannot be reliably zeroized in JS; keep this scope minimal and
    // never return, store, log, or attach the bearer code to an error.
  }
}
