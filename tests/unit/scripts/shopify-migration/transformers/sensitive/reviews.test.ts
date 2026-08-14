import { describe, expect, it } from "vitest";
import type { JudgeMeFileRow, JudgeMeReview } from "@/scripts/shopify-migration/lib/types";
import { providerFingerprint } from "@/scripts/shopify-migration/lib/ids";
import {
  judgeMeReviewFingerprint,
  normalizeJudgeMeFileRow,
  normalizeJudgeMeFileRows,
  transformJudgeMeReviews,
} from "@/scripts/shopify-migration/transformers/sensitive/reviews";

const generatedAt = "2026-08-14T12:00:00.000Z";
const productId = "product_target";
const customerId = "customer_target";

function review(overrides: Partial<JudgeMeReview> = {}): JudgeMeReview {
  return {
    title: "Example review",
    body: "A synthetic review body for migration tests.",
    rating: 5,
    review_date: "2025-01-01T00:00:00Z",
    reviewer_name: "Example Reviewer",
    reviewer_email: "reviewer@example.invalid",
    product_id: "product-source-private",
    product_handle: "example-product",
    source: "judge.me",
    ...overrides,
  };
}

function mappings() {
  return {
    productIds: new Map([
      [providerFingerprint("shopify", "product", "product-source-private"), productId],
      [providerFingerprint("shopify", "product_handle", "example-product"), productId],
    ]),
    customerIdsByEmailFingerprint: new Map([
      [providerFingerprint("shopify", "customer_email", "reviewer@example.invalid"), customerId],
    ]),
  };
}

describe("Judge.me review transform", () => {
  it("normalizes bounded Judge.me CSV strings into typed reviews", () => {
    const row: JudgeMeFileRow = {
      title: "  Example review  ",
      body: "Line one.\r\nLine two.",
      rating: " 5 ",
      created_at: " 2025-01-01T00:00:00Z ",
      reviewer_name: " Example Reviewer ",
      reviewer_email: " REVIEWER@EXAMPLE.INVALID ",
      product_id: " product-source-private ",
      product_handle: " example-product ",
      status: " approved ",
      ignored_private_column: "not retained",
    };

    expect(normalizeJudgeMeFileRow(row)).toEqual({
      title: "Example review",
      body: "Line one.\nLine two.",
      rating: 5,
      review_date: "2025-01-01T00:00:00Z",
      reviewer_name: "Example Reviewer",
      reviewer_email: "reviewer@example.invalid",
      product_id: "product-source-private",
      product_handle: "example-product",
      status: "approved",
    });
  });

  it("rejects invalid CSV ratings and bounds without retaining raw rows", () => {
    const privateMarker = "private-reviewer@example.invalid";
    const result = normalizeJudgeMeFileRows([
      { rating: "4.5", body: "Synthetic body", product_handle: "example-product" },
      { rating: "5", body: "x".repeat(10_001), product_handle: "example-product" },
      { rating: "5", body: "Synthetic body", reviewer_email: privateMarker },
    ]);

    expect(result.records).toEqual([]);
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      "Review rating must be an integer from 1 to 5",
      "Text exceeds 10000 characters",
      "Review product identity is missing",
    ]);
    expect(result.skipped.every((entry) => entry.sourceFingerprint === null)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  });

  it("is deterministic and defaults to pending, unverified history", () => {
    const options = { generatedAt, ...mappings() };
    const first = transformJudgeMeReviews([review()], options);
    const second = transformJudgeMeReviews([review()], options);
    expect(first).toEqual(second);
    expect(first.skipped).toEqual([]);

    const transformed = first.records[0];
    expect(transformed.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(transformed.review).toMatchObject({
      id: expect.stringMatching(/^judge_me_review_/),
      product_id: productId,
      customer_id: customerId,
      order_id: expect.stringMatching(/^judge_me_imported_order_/),
      order_item_id: null,
      status: "pending",
      is_verified: false,
      submitted_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
    });
    expect(JSON.parse(transformed.review.metadata)).toMatchObject({
      verified_purchase_provenance: "none",
      reviewer_name: "Example Reviewer",
      migration: { provider: "judge_me", imported: true },
    });
    expect(JSON.stringify(transformed)).not.toContain("reviewer@example.invalid");
    expect(JSON.stringify(transformed)).not.toContain("product-source-private");
  });

  it("fingerprints bounded long review content without persisting it in identity metadata", () => {
    const input = review({ body: "Synthetic sentence. ".repeat(300) });
    const result = transformJudgeMeReviews([input], { generatedAt, ...mappings() });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.records[0].review.metadata).not.toContain("Synthetic sentence");
  });

  it("sets verified only from explicit matching order provenance", () => {
    const input = review({ status: "published" });
    const fingerprint = judgeMeReviewFingerprint(input);
    const result = transformJudgeMeReviews([input], {
      generatedAt,
      ...mappings(),
      verifiedPurchases: new Map([[fingerprint, {
        verified: true,
        productId,
        customerId,
        orderId: "order_target",
        orderItemId: "line_target",
      }]]),
    });
    expect(result.records[0].review).toMatchObject({
      is_verified: true,
      status: "published",
      order_id: "order_target",
      order_item_id: "line_target",
      customer_id: customerId,
      published_at: "2025-01-01T00:00:00.000Z",
    });
    expect(JSON.parse(result.records[0].review.metadata).verified_purchase_provenance)
      .toBe("explicit_order_match");
  });

  it("rejects mismatched provenance and omits unverified external media", () => {
    const input = review({ picture_urls: "https://media.example.invalid/review.png" });
    const fingerprint = judgeMeReviewFingerprint(input);
    const result = transformJudgeMeReviews([input], {
      generatedAt,
      ...mappings(),
      verifiedPurchases: new Map([[fingerprint, {
        verified: true,
        productId: "different_product",
        customerId,
        orderId: "order_target",
      }]]),
    });
    expect(result.records[0].review.is_verified).toBe(false);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.join(" ")).toContain("invalid verified-purchase provenance");
    expect(result.warnings.join(" ")).toContain("media omitted");
    expect(result.records[0].review.metadata).not.toContain("media.example.invalid");
  });

  it("maps only explicit publication and suppression states", () => {
    const result = transformJudgeMeReviews([
      review({ review_date: "2025-01-01", status: "approved" }),
      review({ review_date: "2025-01-02", status: "spam" }),
      review({ review_date: "2025-01-03", status: "unknown" }),
    ], { generatedAt, ...mappings() });
    expect(result.records.map(({ review: value }) => [value.status, Boolean(value.published_at)])).toEqual([
      ["published", true],
      ["suppressed", false],
      ["pending", false],
    ]);
  });

  it("skips invalid ratings, missing bodies, ambiguous products, and duplicates", () => {
    const duplicate = review();
    const ambiguous = review({ review_date: "2025-02-01" });
    const ambiguousMappings = mappings();
    ambiguousMappings.productIds.set(
      providerFingerprint("shopify", "product_handle", "example-product"),
      "different_product",
    );
    const invalid = transformJudgeMeReviews([
      review({ rating: 4.5 }),
      review({ review_date: "2025-01-02", body: "" }),
    ], { generatedAt, ...mappings() });
    const ambiguousResult = transformJudgeMeReviews([ambiguous], {
      generatedAt,
      ...ambiguousMappings,
    });
    const duplicates = transformJudgeMeReviews([duplicate, duplicate], { generatedAt, ...mappings() });

    expect(invalid.records).toEqual([]);
    expect(invalid.skipped.map(({ reason }) => reason)).toEqual([
      "Review rating must be an integer from 1 to 5",
      "Required text is empty",
    ]);
    expect(ambiguousResult.skipped[0].reason).toBe("Review product mapping is missing or ambiguous");
    expect(duplicates.records).toHaveLength(1);
    expect(duplicates.skipped[0].reason).toBe("Duplicate review source identity");
    expect([...invalid.skipped, ...ambiguousResult.skipped, ...duplicates.skipped]
      .every((entry) => !("record" in entry))).toBe(true);
  });
});
