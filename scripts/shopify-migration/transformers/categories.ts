import type { ShopifyCollection } from "../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  UNKNOWN_SOURCE_TIMESTAMP,
  boundedPositiveInteger,
  canonicalProviderRecords,
  clampInventory,
  excerptFromHtml,
  fitsEscapedSqlText,
  hasValidTimestamp,
  isoTimestamp,
  mediaHostAllowlist,
  mediaRewrite,
  normalizeSlug,
  requiredMigrationTime,
  type MediaRewrite,
  type PureTransformResult,
} from "./_shared.js";

export interface CategoryInsertRecord {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: "active" | "inactive";
  parent_id: null;
  position: number;
  path: string;
  external_references: string;
  created_at: string;
  updated_at: string;
  children: string;
  product_count: number;
  attributes: string;
  tags: string;
  primary_image: string | null;
  media: string | null;
  seo: null;
  extensions: string;
}

export interface CategoryTransformRecord {
  sourceFingerprint: string;
  category: CategoryInsertRecord;
  media: MediaRewrite[];
}

export interface CategoryTransformOptions {
  generatedAt: string;
  allowedMediaHosts: readonly string[];
}

export function transformCollections(
  collections: readonly ShopifyCollection[],
  options: CategoryTransformOptions,
): PureTransformResult<ShopifyCollection, CategoryTransformRecord> {
  requiredMigrationTime(options.generatedAt);
  const allowedMediaHosts = mediaHostAllowlist(options.allowedMediaHosts);
  const records: CategoryTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const skipped: Array<{ record: ShopifyCollection; reason: string }> = [];
  const warnings: string[] = [];
  const sourceByFingerprint = new Map<string, ShopifyCollection>();

  const canonical = canonicalProviderRecords(collections, "category", (collection) => collection.id);
  canonical.records.forEach((collection) => {
    const sourceId = String(collection.id ?? "").trim();
    const sourceFingerprint = sourceId ? providerFingerprint(SHOPIFY_PROVIDER, "category", sourceId) : "";
    const slug = normalizeSlug(collection.handle ?? "");
    const title = collection.title?.trim();
    if (
      !sourceId || sourceId.length > 256 || !slug || slug.length > 160 || !title || title.length > 120 ||
      (collection.body_html?.length ?? 0) > 100_000
    ) {
      skipped.push({ record: collection, reason: "Collection requires an id, title, and valid handle" });
      return;
    }
    if (canonical.duplicateFingerprints.has(sourceFingerprint)) {
      skipped.push({ record: collection, reason: "Duplicate collection source identity" });
      return;
    }
    const id = deterministicProviderId(SHOPIFY_PROVIDER, "category", sourceId);
    const description = collection.body_html
      ? JSON.stringify({ en: excerptFromHtml(collection.body_html, 10_000) ?? "" })
      : null;
    if (description && !fitsEscapedSqlText(description, 24 * 1024)) {
      skipped.push({ record: collection, reason: "Category description exceeds the SQL-safe text limit" });
      return;
    }
    sourceByFingerprint.set(sourceFingerprint, collection);
    const image = collection.image?.src
      ? mediaRewrite(collection.image.src, allowedMediaHosts, id, "category", 1, {
        altText: (collection.image.alt?.trim() || title).slice(0, 300),
        width: boundedPositiveInteger(collection.image.width),
        height: boundedPositiveInteger(collection.image.height),
      })
      : null;
    if (collection.image?.src && !image) {
      warnings.push(
        `Collection ${providerFingerprint(SHOPIFY_PROVIDER, "category", sourceId)} has an invalid or unsupported image URL; image omitted`,
      );
    }
    const primaryImage = image ? {
      id: deterministicProviderId(SHOPIFY_PROVIDER, "media", `${sourceId}:category:1`),
      type: "image",
      status: "active",
      external_references: {
        shopify_fingerprint: providerFingerprint(SHOPIFY_PROVIDER, "media", `${sourceId}:category:1`),
      },
      file: {
        url: image.publicPath,
        format: image.objectKey.split(".").at(-1) ?? "jpg",
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
      },
      accessibility: { alt_text: image.altText },
    } : null;

    records.push({
      sourceFingerprint,
      media: image ? [image] : [],
      category: {
        id,
        name: JSON.stringify({ en: title }),
        description,
        slug,
        status: hasValidTimestamp(collection.published_at) ? "active" : "inactive",
        parent_id: null,
        position: 0,
        path: `/${slug}`,
        external_references: JSON.stringify({
          shopify_fingerprint: sourceFingerprint,
        }),
        created_at: isoTimestamp(collection.published_at, UNKNOWN_SOURCE_TIMESTAMP),
        updated_at: isoTimestamp(collection.updated_at, UNKNOWN_SOURCE_TIMESTAMP),
        children: "[]",
        product_count: clampInventory(collection.products_count),
        attributes: "{}",
        tags: "[]",
        primary_image: primaryImage ? JSON.stringify(primaryImage) : null,
        media: primaryImage ? JSON.stringify([primaryImage]) : null,
        seo: null,
        extensions: JSON.stringify({ shopify: { collection_type: collection.collection_type ?? null } }),
      },
    });
  });

  const slugCounts = new Map<string, number>();
  for (const { category } of records) slugCounts.set(category.slug, (slugCounts.get(category.slug) ?? 0) + 1);
  const accepted = records.flatMap((record) => {
    if (slugCounts.get(record.category.slug) === 1) return [record];
    skipped.push({ record: sourceByFingerprint.get(record.sourceFingerprint)!, reason: `Ambiguous duplicate category slug: ${record.category.slug}` });
    return [];
  }).map((record, position) => ({
    ...record,
    category: { ...record.category, position: position + 1 },
  }));
  for (const record of accepted) idMap.set(record.sourceFingerprint, record.category.id);
  return { records: accepted, idMap, skipped, warnings };
}
