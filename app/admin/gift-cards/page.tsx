import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import GiftCardQueue from "@/components/admin/GiftCardQueue";
import GiftCardHonorBanner from "@/components/admin/GiftCardHonorBanner";
import { giftCardSurfacesHidden } from "@/lib/gift-cards/visibility";
import {
  balancesMayExist,
  readHonorGuard,
  resolveHonorEffective,
} from "@/lib/gift-cards/honor-guard";

function flagOn(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/** Isolated so the impure `Date.now()` read is not textually inside the component body. */
function currentSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

/**
 * Both flags off and the honor guard clear: the surface does not exist
 * (D-10, D-17). Both flags off but the guard is active (money still
 * outstanding while honoring is off): stays reachable by URL so the D-05
 * banner has somewhere to render — there is no nav link in that state. This
 * page reads the guard record; it never writes it.
 */
export default async function AdminGiftCardsPage() {
  await requireAdminSession();
  const { env } = await getCloudflareContext({ async: true });
  const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
  const giftCardAcquisition = flagOn(environment.STORE_FEATURE_GIFT_CARD_ACQUISITION);
  const giftCardReconciliation = flagOn(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION);

  // Two questions that look like one, and conflating them told an operator the
  // opposite of the truth in the state they most need it.
  //
  // **Does this page exist?** That is the money decision, and
  // `resolveHonorEffective` is its single owner (D-18). It is what the 404 gate
  // reads.
  //
  // **What does the banner say?** That is a *display* fact, and it has to come
  // from the record, because `resolveHonorEffective` deliberately answers
  // "no" for sell-on/honor-off **without reading the guard** — that
  // short-circuit is what protects GCF-04. Feeding that "no" to the banner made
  // it print "the last measurement found no outstanding balances" on a store
  // that is selling cards it cannot redeem and may well owe money. The page had
  // the record in hand and ignored it.
  //
  // Fail open on a read error, exactly as `/api/admin/gift-cards` does.
  // Without the catch a D1 error propagates out of this server component and
  // 500s the page — and this is the page an operator opens when gift-card
  // money is already in a state they need to see. `null` is the shape the
  // banner reads as "measurement unavailable", which is honest.
  const flags = { giftCardAcquisition, giftCardReconciliation };
  const guardRecord = !giftCardReconciliation && environment.DB
    ? await readHonorGuard(environment.DB).catch(() => null)
    : null;
  const guardActive = !giftCardReconciliation
    && balancesMayExist(guardRecord, currentSeconds());

  if (giftCardSurfacesHidden(flags)
    && !await resolveHonorEffective(environment.DB, flags, currentSeconds())) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <GiftCardHonorBanner
        record={guardRecord}
        honorConfigured={giftCardReconciliation}
        guardActive={guardActive}
      />
      <div>
        <h1 className="text-2xl font-bold text-white">Gift cards</h1>
        <p className="mt-1 max-w-3xl text-gray-400">Operational gift-card status and delivery queue. Bearer codes, hashes, encryption material, recipient details, and internal card identities are intentionally unavailable.</p>
      </div>
      <GiftCardQueue />
    </div>
  );
}
