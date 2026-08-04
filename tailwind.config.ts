import type { Config } from "tailwindcss";
import { storeDefaults } from "./lib/store-config";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        store: {
          primary: "var(--store-primary)",
          surface: "var(--store-surface)",
          "surface-elevated": "var(--store-surface-elevated)",
          foreground: "var(--store-foreground)",
          "muted-foreground": "var(--store-muted-foreground)",
        },
        primary: storeDefaults.theme.primary,
        background: "#000000",
        foreground: "#ffffff",
        border: "#2a2a2a",
        ring: "#333333",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
