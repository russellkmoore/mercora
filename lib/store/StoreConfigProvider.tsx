"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreConfig } from "@/lib/store-config";

const StoreConfigContext = createContext<StoreConfig | null>(null);

export function StoreConfigProvider({ config, children }: { config: StoreConfig; children: ReactNode }) {
  return <StoreConfigContext.Provider value={config}>{children}</StoreConfigContext.Provider>;
}

export function useStoreConfig() {
  const config = useContext(StoreConfigContext);
  if (!config) throw new Error("useStoreConfig must be used within StoreConfigProvider");
  return config;
}
