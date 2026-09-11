import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../app/account/orders/[id]/page.tsx", import.meta.url),
  "utf8",
);

describe("account order detail gift-card block source contract", () => {
  it("imports GiftCardRecipientBlock on exactly two lines (import + render)", () => {
    const matchingLines = source.split("\n").filter((line) => line.includes("GiftCardRecipientBlock"));
    expect(matchingLines.length).toBe(2);
  });

  it("renders the block at the detail variant exactly once", () => {
    const matches = source.match(/variant="detail"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("guards the render on the item's persisted gift_card", () => {
    const renderIndex = source.lastIndexOf("GiftCardRecipientBlock");
    const before = source.slice(0, renderIndex);
    expect(before).toMatch(/item\.gift_card\s*&&/);
  });

  it("still keys the item list on the existing id-or-index fallback", () => {
    expect(source).toContain("item.id ??");
  });

  it("keeps the auth call, sign-in redirect, notFound guard, and ownership-scoped load", () => {
    expect(source).toContain("const { userId } = await auth()");
    expect(source).toContain("if (!userId) redirect(");
    expect(source).toContain("notFound()");
    expect(source).toContain("getOrderByCustomerAndId(userId, id)");
  });

  it("contains no client-component directive and no fetch call", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    expect(source).not.toMatch(/fetch\(/);
  });

  it("does not import anything from lib/gift-cards", () => {
    expect(source).not.toContain("lib/gift-cards");
  });

  it("resolves the address from shipping with a nullish fallback to billing", () => {
    expect(source).toMatch(/const address = order\.shipping_address \?\? order\.billing_address;/);
  });

  it("renders the address section heading from a variable, not a hardcoded literal", () => {
    expect(source).toMatch(/const addressHeading = order\.shipping_address/);
    expect(source).not.toMatch(/<h2[^>]*>Shipping address<\/h2>/);
    expect(source).not.toMatch(/<h2[^>]*>Billing address<\/h2>/);
  });
});
