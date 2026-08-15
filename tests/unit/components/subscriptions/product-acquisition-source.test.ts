import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("product subscription acquisition integration", () => {
  it("preserves one-time cart purchase while binding subscriptions to the selected variant", () => {
    const source = fs.readFileSync(path.join(root, "app/product/[slug]/ProductDisplay.tsx"), "utf8");
    expect(source).toContain("useCartStore.getState().addItem");
    expect(source).toContain(">\n                Add to Cart\n");
    expect(source).toContain("variantId={selectedVariant.id}");
    expect(source).toContain("available && selectedVariant?.id && subscription?.enabled");
  });

  it("uses Clerk and Stripe Elements without persisting or logging provider secrets", () => {
    const source = fs.readFileSync(
      path.join(root, "components/subscriptions/SubscriptionAcquisitionPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("useAuth()");
    expect(source).toContain("<SignInButton mode=\"modal\">");
    expect(source).toContain("<StripeProvider clientSecret={setup.clientSecret}>");
    expect(source).toContain("<PaymentElement");
    expect(source).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);
  });
});
