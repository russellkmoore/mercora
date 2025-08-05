"use client";

import { useEffect, useState } from "react";
import CheckoutClient from "./CheckoutClient";
import { useCartStore } from "@/lib/stores/cart-store";

interface CheckoutWrapperProps {
  userId: string | null;
}

/**
 * Client-side wrapper for CheckoutClient
 * Uses ClientOnly pattern to prevent hydration mismatches
 */
export default function CheckoutWrapper({ userId }: CheckoutWrapperProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading checkout...</div>
      </div>
    );
  }

  return <CheckoutClient userId={userId} />;
}
