import { createHash } from "node:crypto";
import type { ReviewStatus } from "../../../../lib/types/review.js";
import type { JudgeMeFileRow, JudgeMeReview } from "../../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  isoTimestamp,
  normalizeSlug,
  requiredMigrationTime,
} from "../_shared.js";
import {
  assertBatchSize,
  boundedText,
  emailFingerprint,
  normalizedEmail,
  safeTargetId,
  type SensitiveTransformResult,
} from "./_shared.js";

const REVIEW_PROVIDER = "judge_me";

export interface JudgeMeNormalizationResult {
  records: JudgeMeReview[];
  skipped: Array<{ sourceFingerprint: string | null; reason: string }>;
  warnings: string[];
}

export interface ImportedReviewInsertRecord {
  id: string;
  product_id: string;
  order_id: string;
  order_item_id: string | null;
  customer_id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  is_verified: boolean;
  automated_moderation: null;
  moderation_notes: null;
  admin_response: string | null;
  response_author_id: null;
  responded_at: null;
  submitted_at: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: string;
}

export interface ImportedReviewTransformRecord {
  sourceFingerprint: string;
  review: ImportedReviewInsertRecord;
}

export interface VerifiedReviewProvenance {
  verified: true;
  productId: string;
  orderId: string;
  customerId: string;
  orderItemId?: string;
}

export interface ReviewTransformOptions {
  generatedAt: string;
  productIds: ReadonlyMap<string, string>;
  customerIdsByEmailFingerprint?: ReadonlyMap<string, string>;
  verifiedPurchases?: ReadonlyMap<string, VerifiedReviewProvenance>;
}

export function judgeMeReviewFingerprint(review: JudgeMeReview): string {
  const material = JSON.stringify([
    review.product_id ?? "",
    normalizeSlug(review.product_handle ?? ""),
    review.review_date ?? "",
    review.reviewer_email?.trim().toLowerCase() ?? "",
    review.rating,
    review.body,
  ]);
  const materialDigest = createHash("sha256").update(material, "utf8").digest("hex");
  return providerFingerprint(REVIEW_PROVIDER, "review", materialDigest);
}

/**
 * Convert one bounded CSV row into the typed input accepted by the review
 * transform. Unknown CSV columns and raw row objects never cross this seam.
 */
export function normalizeJudgeMeFileRow(row: JudgeMeFileRow): JudgeMeReview {
  const ratingText = boundedText(row.rating, 8, { required: true })!;
  if (!/^[1-5]$/.test(ratingText)) {
    throw new RangeError("Review rating must be an integer from 1 to 5");
  }
  const body = boundedText(row.body, 10_000, { required: true, multiline: true })!;
  const reviewDate = boundedText(row.review_date ?? row.created_at, 100);
  const title = boundedText(row.title, 200);
  const reviewerName = boundedText(row.reviewer_name, 200);
  const reviewerEmail = normalizedEmail(row.reviewer_email);
  const productId = boundedText(row.product_id, 512);
  const productHandle = boundedText(row.product_handle, 255);
  if (!productId && !productHandle) {
    throw new TypeError("Review product identity is missing");
  }
  const reply = boundedText(row.reply, 5_000, { multiline: true });
  const pictureUrls = boundedText(row.picture_urls, 10_000, { multiline: true });
  const source = boundedText(row.source, 100);
  const status = boundedText(row.status, 64);

  return {
    body,
    rating: Number(ratingText),
    ...(title ? { title } : {}),
    ...(reviewDate ? { review_date: reviewDate } : {}),
    ...(reviewerName ? { reviewer_name: reviewerName } : {}),
    ...(reviewerEmail ? { reviewer_email: reviewerEmail } : {}),
    ...(productId ? { product_id: productId } : {}),
    ...(productHandle ? { product_handle: productHandle } : {}),
    ...(reply ? { reply } : {}),
    ...(pictureUrls ? { picture_urls: pictureUrls } : {}),
    ...(source ? { source } : {}),
    ...(status ? { status } : {}),
  };
}

/** Batch normalizer with privacy-safe failure reporting for operator tooling. */
export function normalizeJudgeMeFileRows(
  rows: readonly JudgeMeFileRow[],
): JudgeMeNormalizationResult {
  assertBatchSize(rows.length);
  const records: JudgeMeReview[] = [];
  const skipped: JudgeMeNormalizationResult["skipped"] = [];

  for (const row of rows) {
    try {
      records.push(normalizeJudgeMeFileRow(row));
    } catch (error) {
      skipped.push({
        sourceFingerprint: null,
        reason: error instanceof Error ? error.message : "Judge.me file row is invalid",
      });
    }
  }

  return { records, skipped, warnings: [] };
}

function resolvedProductId(review: JudgeMeReview, mappings: ReadonlyMap<string, string>): string | null {
  const handle = normalizeSlug(review.product_handle ?? "");
  const byHandle = handle
    ? safeTargetId(mappings.get(providerFingerprint(SHOPIFY_PROVIDER, "product_handle", handle)))
    : null;
  const byId = review.product_id
    ? safeTargetId(mappings.get(providerFingerprint(SHOPIFY_PROVIDER, "product", review.product_id)))
    : null;
  if (byHandle && byId && byHandle !== byId) return null;
  return byHandle ?? byId;
}

function reviewStatus(value: string | undefined): ReviewStatus {
  const status = value?.trim().toLowerCase();
  if (status === "published" || status === "approved") return "published";
  if (status === "hidden" || status === "rejected" || status === "spam") return "suppressed";
  return "pending";
}

function validProof(
  proof: VerifiedReviewProvenance | undefined,
  productId: string,
  customerId: string | null,
): VerifiedReviewProvenance | null {
  if (!proof || proof.verified !== true) return null;
  const product = safeTargetId(proof.productId);
  const order = safeTargetId(proof.orderId);
  const customer = safeTargetId(proof.customerId);
  const item = proof.orderItemId === undefined ? null : safeTargetId(proof.orderItemId);
  if (!product || !order || !customer || product !== productId || (customerId && customer !== customerId)) return null;
  if (proof.orderItemId !== undefined && !item) return null;
  return { verified: true, productId: product, orderId: order, customerId: customer, ...(item ? { orderItemId: item } : {}) };
}

export function transformJudgeMeReviews(
  reviews: readonly JudgeMeReview[],
  options: ReviewTransformOptions,
): SensitiveTransformResult<ImportedReviewTransformRecord> {
  assertBatchSize(reviews.length);
  const generatedAt = requiredMigrationTime(options.generatedAt);
  const records: ImportedReviewTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const skipped: Array<{ sourceFingerprint: string | null; reason: string }> = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const review of reviews) {
    let failedFingerprint: string | null = null;
    try {
      const sourceFingerprint = judgeMeReviewFingerprint(review);
      failedFingerprint = sourceFingerprint;
      if (seen.has(sourceFingerprint)) throw new TypeError("Duplicate review source identity");
      if (!Number.isSafeInteger(review.rating) || review.rating < 1 || review.rating > 5) {
        throw new RangeError("Review rating must be an integer from 1 to 5");
      }
      const productId = resolvedProductId(review, options.productIds);
      if (!productId) throw new TypeError("Review product mapping is missing or ambiguous");
      const email = normalizedEmail(review.reviewer_email);
      const customerId = email
        ? safeTargetId(options.customerIdsByEmailFingerprint?.get(emailFingerprint(email)))
        : null;
      const proof = validProof(options.verifiedPurchases?.get(sourceFingerprint), productId, customerId);
      if (options.verifiedPurchases?.has(sourceFingerprint) && !proof) {
        warnings.push(`Review ${sourceFingerprint} has invalid verified-purchase provenance; imported unverified`);
      }
      if (review.picture_urls?.trim()) {
        warnings.push(`Review ${sourceFingerprint} has external media that requires a separate verified media import; media omitted`);
      }
      const status = reviewStatus(review.status);
      const submittedAt = isoTimestamp(review.review_date, generatedAt);
      const id = deterministicProviderId(REVIEW_PROVIDER, "review", sourceFingerprint);
      const reviewerName = boundedText(review.reviewer_name, 200);
      const orderId = proof?.orderId
        ?? deterministicProviderId(REVIEW_PROVIDER, "imported_order", sourceFingerprint);
      const resolvedCustomerId = proof?.customerId ?? customerId
        ?? deterministicProviderId(REVIEW_PROVIDER, "imported_customer", sourceFingerprint);

      records.push({
        sourceFingerprint,
        review: {
          id,
          product_id: productId,
          order_id: orderId,
          order_item_id: proof?.orderItemId ?? null,
          customer_id: resolvedCustomerId,
          rating: review.rating,
          title: boundedText(review.title, 200),
          body: boundedText(review.body, 10_000, { required: true, multiline: true })!,
          status,
          is_verified: proof !== null,
          automated_moderation: null,
          moderation_notes: null,
          admin_response: boundedText(review.reply, 5_000, { multiline: true }),
          response_author_id: null,
          responded_at: null,
          submitted_at: submittedAt,
          published_at: status === "published" ? submittedAt : null,
          created_at: submittedAt,
          updated_at: generatedAt,
          metadata: JSON.stringify({
            migration: {
              provider: REVIEW_PROVIDER,
              imported: true,
              generated_at: generatedAt,
              source_fingerprint: sourceFingerprint,
            },
            verified_purchase_provenance: proof ? "explicit_order_match" : "none",
            ...(reviewerName ? { reviewer_name: reviewerName } : {}),
          }),
        },
      });
      seen.add(sourceFingerprint);
      idMap.set(sourceFingerprint, id);
    } catch (error) {
      skipped.push({
        sourceFingerprint: failedFingerprint,
        reason: error instanceof Error ? error.message : "Review is invalid",
      });
    }
  }

  return { records, idMap, skipped, warnings };
}
