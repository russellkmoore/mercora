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

  it("states the card is not redeemable for cash", () => {
    expect(content).toMatch(/cash/i);
  });

  it("states the card is not transferable for resale", () => {
    expect(content).toMatch(/resold|resale/i);
  });

  it("describes the checkout redemption step by the field's real name", () => {
    expect(content).toMatch(/redeem/i);
    expect(content.toLowerCase()).toContain("checkout");
    expect(content).toMatch(/gift card.*field/i);
  });

  it("names Account -> Gift Cards as where a balance is visible", () => {
    expect(content).toContain("Account");
    expect(content).toContain("Gift Cards");
  });

  it("front-matter tags carry the retrieval vocabulary: gift, present, voucher", () => {
    expect(content).toMatch(/tags:.*\bgift\b/i);
    expect(content).toMatch(/tags:.*\bpresent\b/i);
    expect(content).toMatch(/tags:.*\bvoucher\b/i);
  });

  it("does not promise a scheduled or future send date", () => {
    expect(content).not.toMatch(/schedule(d)? (a |for |the )?(send|delivery|future)/i);
    expect(content).not.toMatch(/deliver(y|ed)? (on |at )a (future|later|chosen) date/i);
    expect(content).not.toMatch(/delivery date/i);
  });
});
