/**
 * === Shared admin HTTP scaffold for gift-card routes (D-13) ===
 *
 * RED-phase stub. Every export exists so the test file can import and run,
 * but the bodies are deliberately wrong/unimplemented so the behavior
 * assertions in `tests/unit/lib/gift-cards/admin-http.test.ts` fail for real
 * reasons, not an import error.
 */

export const MAX_JSON_BODY_BYTES = 4 * 1_024;

export type ReadBoundedJsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; code: "invalid_json" | "request_too_large"; error: string; status: 400 | 413 };

export async function readBoundedJsonBody(_request: Request): Promise<ReadBoundedJsonBodyResult> {
  throw new Error("not implemented");
}

export function actorFrom(_auth: unknown): unknown {
  throw new Error("not implemented");
}

export function giftCardAdminFlags(_environment: Record<string, unknown>): unknown {
  throw new Error("not implemented");
}

export type GiftCardAdminErrorCode =
  | "invalid_body"
  | "invalid_query"
  | "unauthorized"
  | "forbidden"
  | "gift_card_not_found"
  | "gift_cards_unavailable"
  | "gift_card_reissue_blocked"
  | "gift_card_not_disabled"
  | "delivery_not_found"
  | "delivery_not_requeueable"
  | "reservation_not_releasable"
  | "code_unavailable"
  | "code_reveal_disabled"
  | "gift_cards_read_failed"
  | "gift_cards_write_failed"
  | "request_too_large"
  | "invalid_json";

export function jsonError(_code: GiftCardAdminErrorCode, _message: string, _status: number): unknown {
  throw new Error("not implemented");
}
