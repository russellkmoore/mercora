"use client";

import { useEffect, useState } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';

/**
 * Hook to manually trigger cart store hydration from localStorage
 * Needed when using skipHydration: true to prevent SSR issues
 */
export function useCartPersistence() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Manually rehydrate the store from localStorage
    useCartStore.persist.rehydrate();
    setIsHydrated(true);
  }, []);

  return { isHydrated };
}
