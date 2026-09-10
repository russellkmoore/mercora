/**
 * === Checkout client boundary ===
 *
 * The client half of `/checkout`. It exists so the page itself can be a server
 * component (it has to await the effective honor decision) while the Stripe
 * Elements tree keeps its no-SSR dynamic import, which is a client-only
 * construct and the reason this file is separate rather than inlined.
 *
 * Authentication is still read on the client through Clerk's `useAuth()`,
 * unchanged from when the page was a client component.
 */

"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";

// Dynamically import CheckoutClient with no SSR to prevent hydration issues
const CheckoutClient = dynamic(
  () => import("@/components/checkout/CheckoutClient"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-foreground">Loading checkout...</div>
      </div>
    )
  }
);

interface CheckoutPageClientProps {
  /**
   * Whether gift-card balances are being honored right now — the effective
   * value from the honor guard, not the configured flag. Resolved on the
   * server, because the client cannot read the guard record.
   */
  honorEffective: boolean;
}

export default function CheckoutPageClient({ honorEffective }: CheckoutPageClientProps) {
  // Get authenticated user ID from Clerk on client-side
  const { userId } = useAuth();

  return <CheckoutClient userId={userId || null} honorEffective={honorEffective} />;
}
