import { NextResponse } from "next/server";
import type { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import type { Actor } from "@/lib/fulfillment/types";
import type { GiftCardVisibilityFeatures } from "@/lib/gift-cards/visibility";

/**
 * === Shared admin HTTP scaffold for gift-card routes (D-13) ===
 *
 * One bounded-body parser, one actor builder, one flag reader and one typed
 * error shape for every route plans 14-06 and 14-07 add, so the phase adds
 * one copy rather than nine. Behavior mirrors the private copy already living
 * in `app/api/admin/orders/[id]/ship/route.ts` — that route is left
 * untouched; this module is the shared extraction for new callers.
 *
 * This module deliberately does NOT decide whether the gift-card surface
 * exists. `resolveHonorEffective` (`lib/gift-cards/honor-guard.ts`) stays the
 * single owner of that question (D-16); each route calls it directly the way
 * `app/api/admin/gift-cards/route.ts` already does.
 */

/** 4 KiB — the same cap the ship route already enforces. */
export const MAX_JSON_BODY_BYTES = 4 * 1_024;

export type ReadBoundedJsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; code: "invalid_json" | "request_too_large"; error: string; status: 400 | 413 };

/**
 * Parses a request body as JSON, refusing anything over `MAX_JSON_BODY_BYTES`.
 * Checks the declared `content-length` first (cheap, but callers can lie),
 * then the actual encoded byte length of the text that was read, so a lying
 * header cannot bypass the cap.
 */
export async function readBoundedJsonBody(request: Request): Promise<ReadBoundedJsonBodyResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }
  if (!raw) return { ok: true, body: {} };

  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, code: "invalid_json", error: "Invalid request body", status: 400 };
  }
}

/**
 * Builds the `Actor` a gift-card event/ledger write is attributed to, from
 * `checkAdminPermissions`'s result. A service token always attributes to the
 * fixed `api-token` id; everything else is an admin, keyed on the Clerk user
 * id (or `null` when the auth result carries none).
 */
export function actorFrom(auth: Awaited<ReturnType<typeof checkAdminPermissions>>): Actor {
  return auth.isServiceToken
    ? { type: "service", id: "api-token" }
    : { type: "admin", id: auth.userId ?? null };
}

/**
 * Reads the two gift-card feature flags from a worker environment, using the
 * exact string normalisation `app/api/admin/gift-cards/route.ts` already
 * applies: trim, lowercase, and compare against the literal string `"true"`.
 * Anything else — `undefined`, `"TRUE "` after normalising is fine, but `"1"`
 * or a boolean `true` passed by mistake — is off.
 */
export function giftCardAdminFlags(environment: Record<string, unknown>): GiftCardVisibilityFeatures {
  return {
    giftCardAcquisition:
      String(environment.STORE_FEATURE_GIFT_CARD_ACQUISITION ?? "").trim().toLowerCase() === "true",
    giftCardReconciliation:
      String(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? "").trim().toLowerCase() === "true",
  };
}

/** The full D-13 error-code vocabulary for gift-card admin routes. */
export type GiftCardAdminErrorCode =
  | "invalid_body"
  | "invalid_query"
  | "unauthorized"
  | "forbidden"
  | "gift_card_not_found"
  | "gift_cards_unavailable"
  | "gift_card_reissue_blocked"
  | "gift_card_not_disabled"
  | "gift_card_already_disabled"
  | "delivery_not_found"
  | "delivery_not_requeueable"
  | "delivery_not_resendable"
  | "reservation_not_releasable"
  | "code_unavailable"
  | "code_reveal_disabled"
  | "gift_cards_read_failed"
  | "gift_cards_write_failed"
  | "request_too_large"
  | "invalid_json";

/** A `NextResponse.json` error body shaped `{ code, error }`. */
export function jsonError(code: GiftCardAdminErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ code, error: message }, { status });
}
