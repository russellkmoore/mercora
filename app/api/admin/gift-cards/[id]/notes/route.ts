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
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";

/** D-11/D-13: a CSR note, 1-2000 characters, attributed to the calling admin. */
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
  const text = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).text
    : undefined;
  try {
    assertGiftCardReason(text, "gift-card note", 2_000);
  } catch {
    return jsonError("invalid_body", "A note between 1 and 2000 characters is required", 400);
  }

  try {
    const eventId = await appendGiftCardEvent({
      giftCardId: id,
      eventType: "note",
      actor,
      details: { text },
    });
    return NextResponse.json({ eventId });
  } catch {
    return jsonError("gift_cards_write_failed", "Failed to write gift-card note", 503);
  }
}
