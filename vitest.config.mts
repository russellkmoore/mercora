import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    // Unit tests import async React Server Components directly for contract
    // coverage; transform their TSX instead of preserving JSX for Next.
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".open-next/**"],
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
