import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import GiftCardDetail from "@/components/admin/gift-cards/GiftCardDetail";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import { resolveHonorEffective } from "@/lib/gift-cards/honor-guard";

function flagOn(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/** Isolated so the impure `Date.now()` read is not textually inside the component body. */
function currentSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

/**
 * D-16: this page must reach the same existence answer as the list page and
 * `/api/admin/gift-cards` — `giftCardSurfacesHidden` plus a direct call to
 * `resolveHonorEffective`, the single owner of that decision. A bookmarked
 * detail URL that outlives the surface is exactly the failure the ownership
 * contract exists to prevent. This page fetches no card data itself — the
 * client `GiftCardDetail` owns that fetch, matching the orders detail page.
 */
export default async function AdminGiftCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
  const giftCardAcquisition = flagOn(environment.STORE_FEATURE_GIFT_CARD_ACQUISITION);
  const giftCardReconciliation = flagOn(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION);
  const flags = { giftCardAcquisition, giftCardReconciliation };

  if (giftCardSurfacesHidden(flags)
    && !await resolveHonorEffective(environment.DB, flags, currentSeconds())) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gift card detail</h1>
        <p className="mt-1 max-w-3xl text-gray-400">Every action taken here is audited and shown on the timeline below.</p>
      </div>
      <GiftCardDetail giftCardId={id} />
    </div>
  );
}
