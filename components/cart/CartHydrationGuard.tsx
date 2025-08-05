"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/stores/cart-store";

interface CartHydrationGuardProps {
  children: React.ReactNode;
}

/**
 * Hydration guard that ensures cart store is properly hydrated before rendering
 * This prevents hydration mismatches between server and client
 */
export function CartHydrationGuard({ children }: CartHydrationGuardProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // Wait for next tick to ensure Zustand has hydrated from localStorage
    const timer = setTimeout(() => {
      setHasMounted(true);
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
