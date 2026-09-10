import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FILE = "data/r2/knowledge_md/gift-cards.md";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

// This article is uploaded verbatim to the public R2 bucket and embedded
// verbatim (front matter included) into Volt's Vectorize index -- there is
// no template layer between what's committed here and what a shopper reads
// or what the assistant quotes back as fact. So the committed bytes are the
// contract, and this test reads the real file rather than a fixture.
describe("gift-cards knowledge article: promises match what ships", () => {
  const content = readRepoFile(FILE);

  it("does not promise delivery within 1 hour", () => {
    expect(content).not.toMatch(/1 hour/i);
  });

  it("mentions all four denominations", () => {
    for (const amount of ["$25", "$50", "$100", "$200"]) {
      expect(content).toContain(amount);
    }
  });

  it("ties delivery to payment completing, not a clock", () => {
    expect(content).toMatch(/as soon as payment/i);
  });

  it("states the card never expires", () => {
    expect(content).toMatch(/never expire/i);
  });

  // Assert the sentence, not the vocabulary: /cash/i alone passes on the
  // inverse claim ("can be redeemed for cash").
  it("states the card is not redeemable for cash", () => {
    expect(content).toMatch(/cannot be redeemed for cash|not redeemable for cash/i);
  });

  it("states the card is not transferable for resale", () => {
    expect(content).toMatch(/resold|resale/i);
  });

  it("describes the checkout redemption step by the field's real name", () => {
    expect(content).toMatch(/redeem/i);
    expect(content.toLowerCase()).toContain("checkout");
    expect(content).toMatch(/gift card.*field/i);
  });

  // The dashboard is a buyer's receipt list, not a wallet, and only for a
  // There is no account listing for gift cards (removed 2026-09-10): the
  // delivery email is the card. The article must say so plainly and must not
  // send anyone to Account -> Gift cards.
  it("says gift cards are not listed in the account", () => {
    expect(content).toMatch(/not listed in your account/i);
    expect(content).toMatch(/delivery email is the card/i);
    expect(content).not.toMatch(/Account, then Gift cards/i);
    expect(content).not.toMatch(/Account → Gift Cards/i);
  });

  // components/checkout/CheckoutClient.tsx renders a code input and no balance
  // readout; OrderSummary shows only the amount applied to this order.
  it("does not claim checkout displays a remaining balance", () => {
    expect(content).toMatch(/Checkout does not show a card's remaining balance/i);
    expect(content).not.toMatch(/(see|check|view)[^.]{0,40}balance[^.]{0,40}at checkout/i);
  });

  it("front-matter tags carry the retrieval vocabulary: gift, present, voucher", () => {
    expect(content).toMatch(/tags:.*\bgift\b/i);
    expect(content).toMatch(/tags:.*\bpresent\b/i);
    expect(content).toMatch(/tags:.*\bvoucher\b/i);
  });

  // The fulfillment code honours a chosen delivery date: issueLine maps it to
  // gift_card_deliveries.deliver_after, and the claim query holds the row until
  // then. The article must say so rather than promise an unconditional
  // immediate send.
  it("states that a chosen delivery date defers the send to that date", () => {
    expect(content).toMatch(/delivery date chosen at purchase/i);
    expect(content).toMatch(/chose a delivery date at purchase[^.]*sent at the start of that day/i);
    // WR-13: scheduledDeliverAfter uses Date.UTC, so the article must not
    // assert a local-calendar guarantee the scheduler does not make.
    expect(content).toMatch(/runs on UTC/i);
  });

  it("does not promise a send window the code cannot honour", () => {
    expect(content).not.toMatch(/within \d+ (minute|hour|day)/i);
    expect(content).not.toMatch(/instantl?y|immediately/i);
  });
});
