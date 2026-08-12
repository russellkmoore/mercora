import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("persisted cart hydration contract", () => {
  it("waits for Zustand's completion event and has no timer fallback", () => {
    const hook = readFileSync(join(process.cwd(), "lib/hooks/useCartHydration.ts"), "utf8");
    const drawer = readFileSync(join(process.cwd(), "components/cart/CartDrawer.tsx"), "utf8");

    expect(hook).toContain("onFinishHydration");
    expect(hook).toContain("hasHydrated()");
    expect(hook).not.toContain("setTimeout");
    expect(drawer).toContain("useCartHydration()");
  });
});
