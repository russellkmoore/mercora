import type { Actor } from "@/lib/fulfillment/types";

// RED-phase stub (#3770): compiles and exports the right names so the test
// file can import successfully, but every behavior is deliberately wrong so
// the target tests fail on assertions, not on a module-resolution error.

export const GIFT_CARD_EVENT_TYPES: readonly string[] = [];
export type GiftCardEventType = string;

export const GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS: readonly string[] = [];

export function assertGiftCardEventDetails(_details: Record<string, unknown> | undefined): void {
  // Intentionally never throws in the RED stub.
}

export interface AppendGiftCardEventInput {
  giftCardId: string;
  eventType: GiftCardEventType;
  actor: Actor;
  details?: Record<string, unknown>;
  createdAt?: number;
}

export async function appendGiftCardEvent(_input: AppendGiftCardEventInput): Promise<string> {
  return "not-implemented";
}

export async function listGiftCardEvents(
  _giftCardId: string,
  _limit: number,
): Promise<unknown[]> {
  return [];
}
