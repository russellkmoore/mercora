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
    expect(source).toContain("selectedVariant?.id && subscription?.enabled");
    expect(source).toContain("available={available}");
    expect(source).not.toContain("available && selectedVariant?.id && subscription?.enabled");
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
    expect(source).toContain("setup.ownerId === currentOwner");
    expect(source).toContain("window.history.replaceState");
    expect(source).toContain("setWorking(false)");
    expect(source).toContain("Retry finalization");
    expect(source).toContain("setRedirectRetry((value) => value + 1)");
    expect(source).toContain("setConfirmedSetup({ ownerId: setup.ownerId, setupIntentId })");
    expect(source).toContain("finalizeSubscriptionSetup(fetch, confirmedSetup.setupIntentId");
    expect(source).toContain("setConfirmedSetup(null)");
    expect(source).toContain("currentOwner !== null && confirmedSetup?.ownerId !== currentOwner");
    expect(source).toContain("if (!controller.signal.aborted && props.currentOwner() === props.ownerId)");
    expect(source).toContain("if (!available && !setup) return null;");
    expect(source).not.toContain("confirmSetupAndFinalize({");
    expect(source).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);
  });
});
