import Link from "next/link";
import { getStoreConfig } from "@/lib/store-config";

export function accountLinks(subscriptionReconciliation: boolean) {
  return [
    ["Overview", "/account"],
    ["Orders", "/account/orders"],
    ...(subscriptionReconciliation
      ? [["Subscriptions", "/account/subscriptions"] as const]
      : []),
    ["Addresses", "/account/addresses"],
    ["Settings", "/account/settings"],
  ] as const;
}

export function AccountNav() {
  // Gift cards are deliberately not listed in the account (Russell,
  // 2026-09-10): a card is a bearer instrument delivered by email, and the
  // purchaser-keyed listing could never show the recipient anything.
  const links = accountLinks(getStoreConfig().commerce.features.subscriptionReconciliation);
  return (
    <nav aria-label="Account" className="mb-8 flex flex-wrap gap-2 md:w-48 md:flex-col">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-primary hover:text-primary/90">
          {label}
        </Link>
      ))}
    </nav>
  );
}
