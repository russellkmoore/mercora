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
    expect(source).toContain("setWorking(false)");
    expect(source).toContain("Retry finalization");
    expect(source).toContain("setConfirmedSetup({ ownerId: setup.ownerId, setupIntentId })");
    expect(source).toContain("finalizeSubscriptionSetup(fetch, confirmedSetup.setupIntentId");
    expect(source).toContain("setConfirmedSetup(null)");
    expect(source).toContain("currentOwner !== null && confirmedSetup?.ownerId !== currentOwner");
    expect(source).toContain("if (!controller.signal.aborted && props.currentOwner() === props.ownerId)");
    expect(source).toContain("if (!available && !setup) return null;");
    expect(source).not.toContain("confirmSetupAndFinalize({");
    expect(source).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);

    // SUB-01: the add-a-new-address option is always present in the
    // shipping-address select and the select is never disabled by an empty
    // list -- only by loading.
    expect(source).toContain("Add a new address…");
    expect(source).toContain("ADD_NEW_ADDRESS_VALUE");
    expect(source).toContain("AddAddressDialog");
    expect(source).toContain("Add an address to continue");
    expect(source).toContain("Select an address");
    expect(source).toContain("disabled={loadingAddresses}");
    expect(source).not.toContain("disabled={loadingAddresses || visibleAddresses.length === 0}");

    // SUB-01: the navigating "Manage addresses" link to the account page is
    // gone -- the two remaining Link usages are the subscriptions route and
    // the terms-of-service link, neither of which is this literal pair.
    expect(source).not.toContain("Manage addresses");
    expect(source).not.toContain("/account/addresses");

    // SUB-03: the post-save region refreshes, re-scopes, pre-selects, and
    // resets exactly the three attempt-scoped values -- and never touches
    // plan, quantity, or terms-acceptance state.
    const regionStart = source.indexOf("// address-save-region:start");
    const regionEnd = source.indexOf("// address-save-region:end");
    expect(regionStart).toBeGreaterThan(-1);
    expect(regionEnd).toBeGreaterThan(regionStart);
    const region = source.slice(regionStart, regionEnd);
    expect(region).toContain("setAddressesOwner(");
    // Pre-selection must receive the id from the save response, and the
    // sentinel branch of the select must return before any setAddressId.
    expect(region).toContain("nextAddressSelection(next, saved.id)");
    expect(source).toMatch(
      /if \(value === ADD_NEW_ADDRESS_VALUE\) \{(?:\s*\/\/[^\n]*)*\s*if \(viaKeyboard\) setAddNewPending\(true\);\s*else setAddressDialogOpen\(true\);\s*return;\s*\}/,
    );
    expect(region).toContain("setSetup(null)");
    expect(region).toContain('setCheckoutError("")');
    expect(region).toContain("setCompletedOwner(null)");
    expect(region).not.toContain("setSelectedPlanId");
    expect(region).not.toContain("setQuantityText");
    expect(region).not.toContain("setAccepted");
    // The three resets land before the refresh is awaited, and Continue is
    // disabled for the whole refresh, so the previous address can never start
    // a SetupIntent in the gap.
    expect(region.indexOf("setCompletedOwner(null)")).toBeLessThan(region.indexOf("await fetchSavedAddressesForPlan("));
    expect(source).toContain("disabled={working || loadingAddresses || !accepted");
    // The refresh is abortable like every other async path in the panel.
    expect(region).toContain("fetchSavedAddressesForPlan(fetch, selectedPlan, controller.signal)");
    expect(region).toContain("refreshControllerRef.current = controller");
    expect(source).toContain("useEffect(() => () => refreshControllerRef.current?.abort(), []);");
    // A saved address the subscription filter drops is reported, never silent.
    expect(region).toContain("if (saved.id && nextId !== saved.id)");
    // A refresh failure after a successful save is worded as such and clears
    // the selection rather than keeping a stale id.
    expect(region).toContain("Your address was saved, but the list could not be refreshed.");
    expect(region).not.toContain("Saved addresses could not be loaded");
    expect(region).toContain('setAddressId("");');
    // Keyboard traversal onto the sentinel does not open the modal by itself;
    // only a committed choice (mouse pick, popup Enter, or Enter/Space on the
    // pending option) does, and `addressId` is never written the sentinel.
    expect(source).toContain("value={addNewPending ? ADD_NEW_ADDRESS_VALUE : addressId}");
    expect(source).toContain("SELECT_TRAVERSAL_KEYS.has(event.key)");
    expect(source).toContain("if (viaKeyboard) setAddNewPending(true);");
    expect(source).toContain('if (event.key === "Enter" || event.key === " ")');
    expect(source).not.toContain("setAddressId(ADD_NEW_ADDRESS_VALUE)");
    // The modal is attempt-scoped UI state: an owner change closes it.
    expect(source).toMatch(/setStateOwner\(currentOwner\);[\s\S]*?setAddressDialogOpen\(false\);[\s\S]*?setAccepted\(false\);/);

    // D-06: the signed-out branch is untouched -- exactly one sign-in button.
    expect(source.split('<SignInButton mode="modal">').length - 1).toBe(1);
  });

  it("mounts redirect sanitization globally, independent of product and acquisition feature state", () => {
    const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
    const handler = fs.readFileSync(
      path.join(root, "components/subscriptions/SubscriptionSetupReturnHandler.tsx"),
      "utf8",
    );
    const productPage = fs.readFileSync(path.join(root, "app/product/[slug]/page.tsx"), "utf8");

    expect(layout).toContain("<SubscriptionSetupReturnHandler />");
    expect(handler).toContain("scrubStripeSetupRedirect(");
    expect(handler).toContain("window.history.replaceState");
    expect(handler).toContain("completeStripeSetupRedirect({");
    expect(handler).not.toMatch(/subscriptionAcquisition|termsVersion|productId/);
    expect(handler).not.toMatch(/localStorage|sessionStorage|setup_intent_client_secret|console\.(?:log|error)/);
    expect(productPage).toContain('storedProduct.status !== "active"');
  });
});
