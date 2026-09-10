import type { ActorType } from "@/lib/fulfillment/types";

// RED-phase stub (#3770): compiles and exports the right names so the test
// file can import successfully, but the behavior is deliberately wrong (an
// always-empty timeline) so the target tests fail on assertions, not on a
// module-resolution error.

export type GiftCardTimelineSource = "ledger" | "reservation" | "delivery" | "event";

export interface GiftCardTimelineEntry {
  id: string;
  type: string;
  source: GiftCardTimelineSource;
  actorType: ActorType;
  actorId: string | null;
  actorLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: number;
}

export interface BuildGiftCardTimelineArgs {
  database: D1Database;
  giftCardId: string;
  limit?: number;
  now: number;
}

export async function buildGiftCardTimeline(
  _args: BuildGiftCardTimelineArgs,
): Promise<{ entries: GiftCardTimelineEntry[] }> {
  return { entries: [] };
}
