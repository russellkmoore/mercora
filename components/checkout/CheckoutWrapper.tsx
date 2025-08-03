"use client";

import { useEffect, useState } from "react";
import CheckoutClient from "./CheckoutClient";
import { useCartStore } from "@/lib/stores/cart-store";

interface CheckoutWrapperProps {
  userId: string | null;
}

/**
 * Hydration-safe wrapper for CheckoutClient
 * Ensures cart store is properly hydrated before rendering checkout
 */
export default function CheckoutWrapper({ userId }: CheckoutWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const hasStoreHydrated = useCartStore((state) => state.hasHydrated);

  useEffect(() => {
    // Wait for both client mount and store hydration
    if (hasStoreHydrated) {
      setIsHydrated(true);
    }
  }, [hasStoreHydrated]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading checkout...</div>
      </div>
    );
  }

  return <CheckoutClient userId={userId} />;
}
