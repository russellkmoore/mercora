import type { Config } from "tailwindcss";

const runtimeColor = (variable: string) =>
  `rgb(from var(${variable}) r g b / <alpha-value>)`;

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
        primary: runtimeColor("--store-primary"),
        background: runtimeColor("--store-surface"),
        foreground: runtimeColor("--store-foreground"),
        border: "#2a2a2a",
        ring: "#333333",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
