import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
  invalidGiftCardIdResponse,
  jsonError,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";
import { GiftCardDecryptionError } from "@/lib/gift-cards/encryption";
import { appendGiftCardEvent } from "@/lib/gift-cards/events";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import {
  giftCardDeliveryHasStoredCode,
  revealGiftCardDeliveryCode,
} from "@/lib/services/gift-card-fulfillment";
import { getSettings } from "@/lib/utils/settings";

/**
 * D-12/GCA-08: reveal a card's bearer code once, to a super admin, with the
 * setting on and the request confirmed — audited before the code is ever
 * returned. Order matters and every step below must precede the next
 * (T-14-39, T-14-40, T-14-41, T-14-42).
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
  const body = bodyResult.body;
  const confirmed = typeof body === "object" && body !== null
    && (body as Record<string, unknown>).confirm === true;
  if (!confirmed) {
    return jsonError("invalid_body", "Reveal requires { confirm: true }", 400);
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

  // D-12: the setting must be strictly `true` — a missing key is off.
  // WR-06: both D1 reads below answer the typed 503 on failure rather than
  // escaping the handler as an unhandled 500.
  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await getSettings("gift_cards");
  } catch {
    return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
  }
  if (settings["gift_cards.code_reveal_enabled"] !== true) {
    return jsonError("code_reveal_disabled", "Code reveal is disabled", 403);
  }

  // D-12: `isSuperAdminActor` — not `checkAdminPermissions` alone — is what
  // refuses a service token and the development bypass.
  if (!(await isSuperAdminActor(auth))) {
    return jsonError("forbidden", "Super admin access required", 403);
  }

  const flags = giftCardAdminFlags(environment);
  if (giftCardSurfacesHidden(flags)) {
    const nowSeconds = Math.floor(Date.now() / 1_000);
    const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
    if (!guardActive) {
      return jsonError("gift_cards_unavailable", "Gift cards are not available", 404);
    }
  }

  let hasCode: boolean;
  try {
    hasCode = await giftCardDeliveryHasStoredCode({ giftCardId: id, environment });
  } catch {
    return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
  }
  if (!hasCode) {
    return jsonError("code_unavailable", "Gift-card code is unavailable", 409);
  }

  try {
    await appendGiftCardEvent({
      giftCardId: id,
      eventType: "code_revealed",
      actor,
    });
  } catch {
    return jsonError("gift_cards_write_failed", "Failed to record the reveal", 503);
  }

  try {
    const code = await revealGiftCardDeliveryCode({ giftCardId: id, environment });
    const response = NextResponse.json({ code });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    // WR-02: `code_revealed` is already on the record, so say what actually
    // happened. A decrypt failure (tampered or foreign ciphertext) is the
    // card's problem and stays 409; a key-ring misconfiguration (missing or
    // rotated-out key) is the operator's and is reported as 503, not as
    // "code unavailable". The audit write is best-effort: it must not turn
    // an already-failed reveal into a different failure.
    const reason = error instanceof GiftCardDecryptionError ? "decrypt" : "configuration";
    await appendGiftCardEvent({
      giftCardId: id,
      eventType: "code_reveal_failed",
      actor,
      details: { reason },
    }).catch(() => undefined);
    return reason === "decrypt"
      ? jsonError("code_unavailable", "Gift-card code is unavailable", 409)
      : jsonError("gift_cards_write_failed", "Gift-card code could not be revealed", 503);
  }
}
