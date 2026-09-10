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
import { honorIsEffectivelyOn } from "@/lib/gift-cards/honor-guard";
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
 * Whether redemption is live right now. Configured honor short-circuits
 * without touching D1; configured-off reads the single `admin_settings` row the
 * cron maintains — never a balance query on the request path (D-06).
 */
async function resolveHonorEffective(): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    const configuredHonor = flagOn(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION);
    if (configuredHonor) return true;
    if (!environment.DB) return true;
    return await honorIsEffectivelyOn(
      environment.DB,
      false,
      Math.floor(Date.now() / 1_000),
    );
  } catch {
    // Fail open: the server would still honor a code typed into the panel.
    return true;
  }
}

export default async function CheckoutPage() {
  const honorEffective = await resolveHonorEffective();

  return (
    <div className="bg-surface-elevated text-foreground min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <CheckoutPageClient honorEffective={honorEffective} />
      </div>
    </div>
  );
}
