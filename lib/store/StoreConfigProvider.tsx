"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreConfig } from "@/lib/store-config";
import type { ThemeTokens } from "@/lib/themes/tokens";

const StoreConfigContext = createContext<StoreConfig | null>(null);
const ThemeTokensContext = createContext<ThemeTokens | null>(null);

export function StoreConfigProvider({
  config,
  themeTokens,
  children,
}: {
  config: StoreConfig;
  themeTokens: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <StoreConfigContext.Provider value={config}>
      <ThemeTokensContext.Provider value={themeTokens}>{children}</ThemeTokensContext.Provider>
    </StoreConfigContext.Provider>
  );
}

export function useStoreConfig() {
  const config = useContext(StoreConfigContext);
  if (!config) throw new Error("useStoreConfig must be used within StoreConfigProvider");
  return config;
}

export function useThemeTokens() {
  const tokens = useContext(ThemeTokensContext);
  if (!tokens) throw new Error("useThemeTokens must be used within StoreConfigProvider");
  return tokens;
}
