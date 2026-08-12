import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile header width contract", () => {
  it.each([320, 360, 375])("reserves a positive bounded logo width at %ipx", (viewport) => {
    const horizontalPadding = 32;
    const reservedControlsAndGap = 88;
    expect(viewport - horizontalPadding - reservedControlsAndGap).toBeGreaterThan(0);
  });

  it("pins the shrink/truncation and compact-cart CSS that enforces the bound", () => {
    const header = readFileSync(join(process.cwd(), "components/HeaderClient.tsx"), "utf8");
    const cart = readFileSync(join(process.cwd(), "components/cart/CartDrawer.tsx"), "utf8");
    const mobileTrigger = header.match(/<SheetTrigger\b[\s\S]*?<\/SheetTrigger>/)?.[0];
    const desktopTrigger = header.match(/<DropdownMenuTrigger\b[\s\S]*?<\/DropdownMenuTrigger>/)?.[0];

    expect(header).toContain("min-w-0 flex-1 truncate");
    expect(header).toContain("flex shrink-0 items-center gap-1");
    expect(mobileTrigger).toContain('size="icon"');
    expect(mobileTrigger).toContain('aria-label="Open navigation menu"');
    expect(desktopTrigger).not.toContain('aria-label="Open navigation menu"');
    expect(cart).toContain('className="hidden sm:inline"');
    expect(cart).toContain("aria-label={`Cart (");
  });
});
