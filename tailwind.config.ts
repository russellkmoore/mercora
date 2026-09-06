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
        primary: runtimeColor("--store-primary"),
        "on-primary": runtimeColor("--store-on-primary"),
        surface: runtimeColor("--store-surface"),
        "surface-elevated": runtimeColor("--store-surface-elevated"),
        foreground: runtimeColor("--store-foreground"),
        "muted-foreground": runtimeColor("--store-muted-foreground"),
        border: runtimeColor("--store-border"),
        ring: runtimeColor("--store-ring"),
        success: runtimeColor("--store-success"),
        warning: runtimeColor("--store-warning"),
        danger: runtimeColor("--store-danger"),
        info: runtimeColor("--store-info"),
        "surface-inverse": runtimeColor("--store-surface-inverse"),
        "surface-inverse-elevated": runtimeColor("--store-surface-inverse-elevated"),
        "on-inverse": runtimeColor("--store-on-inverse"),
        "muted-on-inverse": runtimeColor("--store-muted-on-inverse"),
        "border-inverse": runtimeColor("--store-border-inverse"),
      },
      borderRadius: {
        sm: "var(--store-radius-sm)",
        md: "var(--store-radius-md)",
        lg: "var(--store-radius-lg)",
        xl: "var(--store-radius-xl)",
      },
      fontFamily: {
        sans: "var(--store-font-sans)",
        display: "var(--store-font-display)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
