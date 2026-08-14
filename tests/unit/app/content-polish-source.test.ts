import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("content publishing integration polish", () => {
  it("renders one controlled cart drawer with responsive triggers and a toast action", () => {
    const header = source("components/HeaderClient.tsx");
    const product = source("app/product/[slug]/ProductDisplay.tsx");
    expect(header.match(/<CartDrawer \/>/g)).toHaveLength(1);
    expect(header.match(/<CartTrigger \/>/g)).toHaveLength(2);
    expect(product).toContain('label: "View Cart"');
    expect(product).toContain("useCartUIStore.getState().openCart()");
    expect(source("lib/stores/cart-ui-store.ts")).not.toMatch(/persist\s*\(/);
  });

  it("uses configured admin identity without demo account strings", () => {
    const header = source("components/admin/AdminHeader.tsx");
    const sidebar = source("components/admin/AdminSidebar.tsx");
    expect(header).toContain("useUser()");
    expect(sidebar).toContain("useStoreConfig()");
    expect(`${header}\n${sidebar}`).not.toMatch(/admin@voltique|Voltique Admin|>Voltique</i);
  });

  it("builds only nonempty footer columns and has no placeholder links", () => {
    const footer = source("components/Footer.tsx");
    expect(footer).toContain("Promise.allSettled");
    expect(footer).toContain("GRID_CLASSES");
    expect(footer).not.toContain('href="#"');
    expect(footer).not.toMatch(/Careers|News & media|Community|Events|Specs/);
  });

  it("preserves category description line breaks and bounds image-overlay copy", () => {
    const category = source("app/category/[slug]/page.tsx");
    expect(category).toContain("line-clamp-3 max-w-2xl whitespace-pre-line");
    expect(category).toContain("mx-auto max-w-2xl whitespace-pre-line");
  });
});
