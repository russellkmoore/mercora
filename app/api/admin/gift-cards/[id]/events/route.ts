import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { giftCardAdminFlags, jsonError } from "@/lib/gift-cards/admin-http";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import { createGiftCardRepository } from "@/lib/gift-cards/repository";
import { buildGiftCardTimeline } from "@/lib/gift-cards/timeline";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * D-04: the merged, oldest-first gift-card timeline. All merge logic lives in
 * `lib/gift-cards/timeline.ts` — this route is auth, the honor gate,
 * existence, and a typed JSON body around it. No `sort` call and no ledger
 * or reservation SQL belongs here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return jsonError("unauthorized", auth.error ?? "Admin access required", 401);
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      return jsonError("invalid_limit", "limit must be a positive integer", 400);
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  const { id } = await params;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error("D1 binding unavailable");

    // D-16: `giftCardSurfacesHidden` plus a direct call to
    // `resolveHonorEffective` — the single owner of the existence decision —
    // the same way the detail route and the list route already do.
    const flags = giftCardAdminFlags(environment);
    const nowSeconds = Math.floor(Date.now() / 1_000);
    if (giftCardSurfacesHidden(flags)) {
      const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
      if (!guardActive) {
        return jsonError("gift_cards_unavailable", "Gift cards are not available", 404);
      }
    }

    const account = await createGiftCardRepository(environment.DB).findAccountById(id);
    if (!account) {
      return jsonError("gift_card_not_found", "Gift card not found", 404);
    }

    const { entries } = await buildGiftCardTimeline({
      database: environment.DB,
      giftCardId: id,
      limit,
      now: nowSeconds,
    });

    return NextResponse.json({
      events: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorLabel: entry.actorLabel,
        details: entry.details,
        createdAt: entry.createdAt,
      })),
      meta: { limit },
    });
  } catch {
    return jsonError("gift_cards_read_failed", "Gift cards are temporarily unavailable", 503);
  }
}
