/**
 * === Checkout Page ===
 *
 * A server component whose only job is to resolve, once per request, the two
 * things the checkout flow cannot work out for itself: whether gift-card
 * balances are actually being honored right now, and where to hand off to the
 * client.
 *
 * === Why the honor value is resolved here ===
 * The redemption panel used to be gated on `commerce.features.
 * giftCardReconciliation`, the raw `STORE_FEATURE_GIFT_CARD_RECONCILIATION`
 * env var. That flag is the *configured* value, and the honor guard exists
 * precisely because the configured value can be wrong: with honor off and
 * balances still outstanding, the server keeps honoring (D-04), the cron pages
 * on-call every five minutes, and the admin banner names the total — while a
 * shopper holding a card had no input to type it into. The panel has to follow
 * the *effective* value, and only a server component can read it.
 *
 * A failed read means "keep honoring" (D-04). Showing a redemption input the
 * server would have accepted is the correct failure; hiding one it would have
 * accepted is not.
 *
 * === Why the client half is a separate file ===
 * `dynamic(..., { ssr: false })` is a client-only construct, and the Stripe
 * Elements tree still must not server-render. `CheckoutPageClient` keeps that
 * boundary — and the client-side Clerk `useAuth()` read — exactly as it was.
 *
 * @returns Server-rendered checkout page with the effective honor decision
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import CheckoutPageClient from "./CheckoutPageClient";

/**
 * The guard is a per-request decision about money in flight. Caching it would
 * let a shopper be shown a stale answer for the life of the cache entry.
 */
export const dynamic = "force-dynamic";

function flagOn(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/**
 * Whether the redemption panel renders. Two decisions, in this order.
 *
 * **Presentation first (D-10, D-18).** With both flags off gift cards do not
 * exist for a visitor: no listing entry, no product page, no balance endpoint,
 * and no checkout panel — whatever the guard says about money. Consulting the
 * guard first got this wrong, because every "we do not know" answer inside it
 * is "keep honoring": the panel appeared for the first five minutes after any
 * deploy, through any cron gap over 900s, on any D1 read failure, and
 * permanently on a deploy that had not applied the gift-card migrations. The
 * sibling balance route already gated on D-10 before reading the guard; these
 * two surfaces now answer the question the same way.
 *
 * Hiding the panel does not stop honoring. Redemption, settlement and refunds
 * keep running server-side in that state (D-04) — there is simply no input
 * offered for a card the store says does not exist.
 *
 * **Then money.** `resolveHonorEffective` is the single owner of that decision
 * (D-18); this page does not re-derive it.
 */
async function resolveCheckoutHonor(): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    const flags = {
      giftCardAcquisition: flagOn(environment.STORE_FEATURE_GIFT_CARD_ACQUISITION),
      giftCardReconciliation: flagOn(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION),
    };
    if (giftCardSurfacesHidden(flags)) return false;
    return await resolveHonorEffective(environment.DB, flags, Math.floor(Date.now() / 1_000));
  } catch {
    // Fail open: the server would still honor a code typed into the panel.
    return true;
  }
}

export default async function CheckoutPage() {
  const honorEffective = await resolveCheckoutHonor();

  return (
    <div className="bg-surface-elevated text-foreground min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <CheckoutPageClient honorEffective={honorEffective} />
      </div>
    </div>
  );
}
