"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/stores/cart-store";

/**
 * Tracks Zustand persistence itself, so consumers become ready only after the
 * local-storage merge has actually completed (including async storage).
 */
export function useCartHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persistence = useCartStore.persist;
    const unsubscribeStart = persistence.onHydrate(() => setIsHydrated(false));
    const unsubscribeFinish = persistence.onFinishHydration(() => setIsHydrated(true));

    if (persistence.hasHydrated()) {
      setIsHydrated(true);
    } else {
      void persistence.rehydrate();
    }

    return () => {
      unsubscribeStart();
      unsubscribeFinish();
    };
  }, []);

  return isHydrated;
}
