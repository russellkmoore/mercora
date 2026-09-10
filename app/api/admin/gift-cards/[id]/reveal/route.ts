import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import {
  actorFrom,
  giftCardAdminFlags,
  jsonError,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";
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

  let environment: Record<string, unknown> & { DB?: D1Database };
  try {
    const { env } = await getCloudflareContext({ async: true });
    environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error("D1 binding unavailable");
  } catch {
    return jsonError("gift_cards_write_failed", "Gift cards are temporarily unavailable", 503);
  }

  // D-12: the setting must be strictly `true` — a missing key is off.
  const settings = await getSettings("gift_cards");
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

  const hasCode = await giftCardDeliveryHasStoredCode({ giftCardId: id, environment });
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
  } catch {
    return jsonError("code_unavailable", "Gift-card code is unavailable", 409);
  }
}
