import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SEED_FILE = "data/d1/seed.sql";
const BEGIN_SENTINEL = "-- BEGIN gift-card-block (Phase 9)";
const END_SENTINEL = "-- END gift-card-block (Phase 9)";

// Same regex checkout-pricing.ts uses to validate a Stripe tax code at quote
// time, re-run here so this test fails if the seeded code shape ever drifts
// away from what checkout accepts -- not just a string-equality check.
const TAX_CODE_REGEX = /^txcd_\d{8}$/;

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

/**
 * Strip SQL line comments before counting identifier occurrences, so a
 * future comment that happens to mention an id (e.g. in a changelog note)
 * can never make a count assertion pass or fail spuriously.
 */
function stripCommentLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function extractGiftCardSlice(seedSql: string): string {
  const beginIndex = seedSql.indexOf(BEGIN_SENTINEL);
  const endIndex = seedSql.indexOf(END_SENTINEL);
  if (beginIndex === -1 || endIndex === -1) {
    throw new Error("gift-card sentinel comments not found in seed.sql");
  }
  return seedSql.slice(beginIndex, endIndex + END_SENTINEL.length);
}

describe("gift-card seed block: sentinel-delimited, replay-safe INSERT OR IGNORE shape", () => {
  const seedSql = readRepoFile(SEED_FILE);

  it("each sentinel comment appears exactly once", () => {
    const beginMatches = seedSql.split(BEGIN_SENTINEL).length - 1;
    const endMatches = seedSql.split(END_SENTINEL).length - 1;
    expect(beginMatches).toBe(1);
    expect(endMatches).toBe(1);
  });

  it("the sentinel slice is non-empty and strictly shorter than the whole file", () => {
    const slice = extractGiftCardSlice(seedSql);
    expect(slice.length).toBeGreaterThan(0);
    expect(slice.length).toBeLessThan(seedSql.length);
  });

  it("the slice contains exactly three statements, each an INSERT OR IGNORE INTO", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));
    const insertMatches = slice.match(/INSERT OR IGNORE INTO/g) ?? [];
    expect(insertMatches).toHaveLength(3);
  });

  it("orders INSERT OR IGNORE statements as products, then product_variants, then pricing", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));
    const tableOrder = Array.from(
      slice.matchAll(/INSERT OR IGNORE INTO (\w+)/g),
    ).map((match) => match[1]);
    expect(tableOrder).toEqual(["products", "product_variants", "pricing"]);
  });

  it("names prod_33 and variant_33 through variant_36, and no other product id", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    expect(slice).toContain("'prod_33'");
    for (const variantId of ["variant_33", "variant_34", "variant_35", "variant_36"]) {
      expect(slice).toContain(`'${variantId}'`);
    }

    const productIds = new Set(
      Array.from(slice.matchAll(/'prod_(\d+)'/g)).map((match) => match[1]),
    );
    expect(Array.from(productIds)).toEqual(["33"]);

    const variantIds = new Set(
      Array.from(slice.matchAll(/'variant_(\d+)'/g)).map((match) => match[1]),
    );
    expect(Array.from(variantIds).sort()).toEqual(["33", "34", "35", "36"]);
  });

  it("carries the nontaxable tax code on the product and all four variants, and it passes the checkout regex", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    const taxCodes = Array.from(slice.matchAll(/'(txcd_\d{8})'/g)).map((match) => match[1]);
    expect(taxCodes.length).toBeGreaterThanOrEqual(5); // 1 product + 4 variants

    for (const code of taxCodes) {
      expect(code).toBe("txcd_00000000");
      expect(TAX_CODE_REGEX.test(code)).toBe(true);
    }
  });

  it("carries four untracked-inventory variants and no bare numeric inventory string", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    const untrackedMatches = slice.match(/\{"track_inventory": false\}/g) ?? [];
    expect(untrackedMatches).toHaveLength(4);

    // Legacy shape: a bare numeric string like '110' in the inventory
    // column position -- not present anywhere in the modern gift-card rows.
    expect(slice).not.toMatch(/'\d+', 'txcd_00000000', [01], '\[\]'/);
  });

  it("carries exactly the four minor-unit amounts 2500, 5000, 10000, and 20000, and no other price amount", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    const amounts = Array.from(slice.matchAll(/"amount":\s*(\d+)/g)).map((match) => match[1]);
    expect(amounts.sort((a, b) => Number(a) - Number(b))).toEqual([
      "2500",
      "5000",
      "10000",
      "20000",
    ]);
  });

  it("points primary_image and media at products/gift-card-33.png", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    const imageMatches = slice.match(/products\/gift-card-33\.png/g) ?? [];
    // primary_image + one media entry = at least 2 references.
    expect(imageMatches.length).toBeGreaterThanOrEqual(2);
  });

  // CR-03: the product description is embedded into the product vector by
  // app/api/admin/vectorize/route.ts and rendered on the product page, so it is
  // retrieved by the same assistant, for the same question, as the knowledge
  // article. The two must not contradict each other on when the card sends.
  it("the catalogue copy does not promise an unconditional immediate send", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));
    expect(slice).toMatch(/arrives by email as soon as payment clears/i);
    expect(slice).toMatch(/or on the delivery date you choose/i);
    // The immediacy claim must never appear without the scheduled qualifier
    // trailing it inside the same description string.
    expect(slice).not.toMatch(/as soon as payment clears(?![^"]*delivery date)/i);
  });

  it("the meta description does not promise an unconditional immediate send", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));
    const metaDescription = slice.match(/"meta_description": "([^"]*)"/)?.[1];
    expect(metaDescription).toBeDefined();
    expect(metaDescription).toMatch(/or on a delivery date you choose/i);
  });

  it("seeds rating as NULL and related_products as an empty JSON array", () => {
    const slice = stripCommentLines(extractGiftCardSlice(seedSql));

    expect(slice).toMatch(/'\{"meta_title"[^}]*\}',\s*NULL,\s*'\[\]'/);
  });
});
