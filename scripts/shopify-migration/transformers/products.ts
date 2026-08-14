import type {
  ShopifyCollect,
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyProductVariant,
} from "../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  UNKNOWN_SOURCE_TIMESTAMP,
  boundedPositiveInteger,
  clampInventory,
  escapedSqlUtf8Bytes,
  fitsEscapedSqlText,
  hasValidTimestamp,
  isoTimestamp,
  majorToStoredMoney,
  mediaHostAllowlist,
  mediaRewrite,
  normalizeSlug,
  plainText,
  requireSupportedCurrency,
  requiredMigrationTime,
  uniqueStrings,
  type MediaRewrite,
  type PureTransformResult,
} from "./_shared.js";

type ProductStatus = "active" | "inactive" | "archived" | "draft";
type VariantStatus = "active" | "inactive" | "discontinued";

const MAX_PRODUCT_TITLE = 500;
const MAX_PRODUCT_BODY = 100_000;
const MAX_PRODUCT_VARIANTS = 2_048;
const MAX_PRODUCT_IMAGES = 250;
const MAX_PRODUCT_CATEGORIES = 100;
const MAX_TAGS = 100;
const MAX_TAG_LENGTH = 100;
const MAX_OPTION_VALUES = 250;
const MAX_OPTION_TEXT = 200;

export interface ProductInsertRecord {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: ProductStatus;
  slug: string;
  brand: string | null;
  categories: string | null;
  tags: string | null;
  options: string | null;
  default_variant_id: string;
  fulfillment_type: "physical" | "digital" | "service";
  tax_category: string | null;
  primary_image: string | null;
  media: string | null;
  seo: string | null;
  rating: null;
  related_products: null;
  external_references: string;
  extensions: string;
  created_at: string;
  updated_at: string;
}

export interface VariantInsertRecord {
  id: string;
  product_id: string;
  sku: string;
  status: VariantStatus;
  position: number;
  option_values: string;
  price: string;
  compare_at_price: string | null;
  cost: null;
  weight: string | null;
  dimensions: null;
  barcode: string | null;
  inventory: string;
  tax_category: string | null;
  shipping_required: boolean;
  media: string;
  attributes: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryInsertRecord {
  id: string;
  sku_id: string;
  location_id: string;
  quantities: string;
  status: "active" | "inactive";
  stock_status: "in_stock" | "out_of_stock" | "backorder";
  external_references: string;
  created_at: string;
  updated_at: string;
  policy_id: null;
  backorderable: boolean;
  backorder_eta: null;
  safety_stock: number;
  version: number;
  extensions: string;
}

export interface ProductTransformRecord {
  sourceFingerprint: string;
  product: ProductInsertRecord;
  variants: VariantInsertRecord[];
  inventory: InventoryInsertRecord[];
  media: MediaRewrite[];
}

export interface ProductTransformOptions {
  currency: string;
  generatedAt: string;
  inventoryLocationId: string;
  fulfillmentType: "physical" | "digital" | "service";
  taxCategory?: string;
  allowedMediaHosts: readonly string[];
  categoryIdsByProduct?: ReadonlyMap<string, readonly string[]>;
}

function productStatus(product: ShopifyProduct): ProductStatus {
  const status = product.status?.trim().toLowerCase();
  if (status === "archived") return "archived";
  if (status === "draft") return "draft";
  if (
    status !== "active" || product.published_at === null ||
    (product.published_at !== undefined && !hasValidTimestamp(product.published_at))
  ) return "inactive";
  return "active";
}

function variantStatus(status: ProductStatus): VariantStatus {
  if (status === "archived") return "discontinued";
  return status === "active" ? "active" : "inactive";
}

function weight(variant: ShopifyProductVariant): string | null {
  const value = variant.grams ?? variant.weight;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  const unit = variant.grams !== undefined ? "g" : variant.weight_unit?.trim().toLowerCase();
  if (!unit || !["g", "kg", "oz", "lb"].includes(unit)) return null;
  return JSON.stringify({ value, unit });
}

function machMedia(
  image: ShopifyProductImage,
  allowedMediaHosts: ReturnType<typeof mediaHostAllowlist>,
  sourceId: string,
  ownerId: string,
  position: number,
): { embedded: Record<string, unknown>; plan: MediaRewrite } | null {
  const plan = mediaRewrite(image.src, allowedMediaHosts, ownerId, "product", position, {
    altText: image.alt?.trim().slice(0, 300) || undefined,
    width: boundedPositiveInteger(image.width),
    height: boundedPositiveInteger(image.height),
  });
  if (!plan) return null;
  return {
    plan,
    embedded: {
      id: deterministicProviderId(SHOPIFY_PROVIDER, "media", `${sourceId}:${String(image.id ?? position)}`),
      type: "image",
      status: "active",
      external_references: {
        shopify_fingerprint: providerFingerprint(
          SHOPIFY_PROVIDER,
          "media",
          `${sourceId}:${String(image.id ?? position)}`,
        ),
      },
      file: {
        url: plan.publicPath,
        format: plan.objectKey.split(".").at(-1) ?? "jpg",
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
      },
      accessibility: { alt_text: plan.altText },
    },
  };
}

export function collectionMembershipByProduct(
  collects: readonly ShopifyCollect[],
  categoryIdBySourceFingerprint: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const collect of collects) {
    const categoryId = categoryIdBySourceFingerprint.get(
      providerFingerprint(SHOPIFY_PROVIDER, "category", collect.collection_id),
    );
    if (!categoryId) continue;
    const productId = providerFingerprint(SHOPIFY_PROVIDER, "product", collect.product_id);
    const existing = result.get(productId) ?? [];
    if (!existing.includes(categoryId) && existing.length < MAX_PRODUCT_CATEGORIES) existing.push(categoryId);
    result.set(productId, existing);
  }
  return result;
}

export function transformProducts(
  products: readonly ShopifyProduct[],
  options: ProductTransformOptions,
): PureTransformResult<ShopifyProduct, ProductTransformRecord> {
  const currency = requireSupportedCurrency(options.currency);
  requiredMigrationTime(options.generatedAt);
  const allowedMediaHosts = mediaHostAllowlist(options.allowedMediaHosts);
  const locationId = options.inventoryLocationId.trim();
  if (!locationId || locationId.length > 200) throw new TypeError("inventoryLocationId must be 1-200 characters");
  if ((options.taxCategory?.trim().length ?? 0) > 200) throw new TypeError("taxCategory must not exceed 200 characters");

  const records: ProductTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const skipped: Array<{ record: ShopifyProduct; reason: string }> = [];
  const warnings: string[] = [];
  const slugs = new Set<string>();
  const skus = new Set<string>();

  for (const source of products) {
    const sourceId = String(source.id ?? "").trim();
    const slug = normalizeSlug(source.handle ?? "");
    const name = source.title?.trim();
    const rawTags = source.tags ?? "";
    const tags = rawTags.length <= 20_000 ? uniqueStrings(rawTags.split(",")) : [];
    const optionsAreBounded = (source.options ?? []).every((option) =>
      (option.id === undefined || String(option.id).length <= 128) &&
      option.name.trim().length > 0 && option.name.trim().length <= 120 &&
      option.values.length <= MAX_OPTION_VALUES &&
      option.values.every((value) => value.trim().length > 0 && value.trim().length <= MAX_OPTION_TEXT));
    const imagesAreBounded = source.images.every((image) =>
      (image.id === undefined || String(image.id).length <= 128) &&
      image.src.length <= 2_048 && (image.alt?.length ?? 0) <= 10_000);
    if (
      !sourceId || sourceId.length > 256 || !slug || slug.length > 160 || !name || name.length > MAX_PRODUCT_TITLE ||
      (source.body_html?.length ?? 0) > MAX_PRODUCT_BODY || (source.vendor?.length ?? 0) > 200 ||
      (source.product_type?.length ?? 0) > 200 || (source.tags?.length ?? 0) > 20_000 ||
      (source.seo_title?.length ?? 0) > 200 || (source.seo_description?.length ?? 0) > 500 ||
      tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH) ||
      source.variants.length > MAX_PRODUCT_VARIANTS || source.images.length > MAX_PRODUCT_IMAGES ||
      (source.options?.length ?? 0) > 3 || !optionsAreBounded || !imagesAreBounded
    ) {
      skipped.push({ record: source, reason: "Product requires an id, title, and valid handle" });
      continue;
    }
    if (slugs.has(slug)) {
      skipped.push({ record: source, reason: `Duplicate product slug: ${slug}` });
      continue;
    }

    const productId = deterministicProviderId(SHOPIFY_PROVIDER, "product", sourceId);
    const sourceFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "product", sourceId);
    const status = productStatus(source);
    const optionDefinitions = (source.options ?? []).slice(0, 3).map((option, position) => ({
      id: deterministicProviderId(SHOPIFY_PROVIDER, "option", `${sourceId}:${String(option.id ?? position + 1)}`),
      name: option.name.trim(),
      values: uniqueStrings(option.values ?? []),
      position: boundedPositiveInteger(option.position, 3) ?? position + 1,
    })).filter((option) => option.name && option.values.length > 0);

    const imageResults = (source.images ?? []).flatMap((image, index) => {
      const result = machMedia(image, allowedMediaHosts, sourceId, productId, index + 1);
      if (!result) {
        warnings.push(
          `Product ${sourceFingerprint} image ${index + 1} omitted: invalid or unsupported image URL`,
        );
        return [];
      }
      return [{ ...result, sourceImageId: image.id === undefined ? null : String(image.id) }];
    });
    const mediaBySourceId = new Map(imageResults.flatMap(({ sourceImageId, embedded }) =>
      sourceImageId === null ? [] : [[sourceImageId, embedded] as const]));

    const variants: VariantInsertRecord[] = [];
    const inventory: InventoryInsertRecord[] = [];
    for (let index = 0; index < source.variants.length; index += 1) {
      const variant = source.variants[index];
      const sku = variant.sku?.trim() || `${slug}-${index + 1}`;
      const rawValues = [variant.option1, variant.option2, variant.option3].filter(
        (value): value is string => value !== null && value !== undefined,
      );
      const rawVariantId = variant.id === undefined ? "" : String(variant.id);
      const identity = rawVariantId && rawVariantId.length <= 256
        ? rawVariantId
        : `${sourceId}:position:${index + 1}`;
      const preliminaryFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "variant", identity);
      if (
        rawVariantId.length > 256 || sku.length > 255 || (variant.barcode?.length ?? 0) > 255 ||
        (variant.price?.length ?? 0) > 100 || (variant.compare_at_price?.length ?? 0) > 100 ||
        rawValues.some((value) => value.trim().length > MAX_OPTION_TEXT) ||
        (variant.fulfillment_service?.length ?? 0) > 200
      ) {
        warnings.push(`Product ${sourceFingerprint} variant ${preliminaryFingerprint} omitted: fields exceed limits`);
        continue;
      }
      const naturalKey = variant.sku?.trim() || [variant.option1, variant.option2, variant.option3]
        .filter((value): value is string => Boolean(value?.trim()))
        .join("|") || variant.barcode?.trim() || `position:${index + 1}`;
      const variantSourceId = String(variant.id ?? `${sourceId}:${naturalKey}`);
      const variantFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "variant", variantSourceId);
      if (skus.has(sku.toLocaleLowerCase("en-US"))) {
        warnings.push(`Product ${sourceFingerprint} variant ${variantFingerprint} omitted: duplicate SKU`);
        continue;
      }
      let price;
      try {
        price = majorToStoredMoney(variant.price, currency);
      } catch {
        warnings.push(`Product ${sourceFingerprint} variant ${variantFingerprint} omitted: invalid price`);
        continue;
      }
      let compareAt = null;
      if (variant.compare_at_price !== null && variant.compare_at_price !== undefined && variant.compare_at_price !== "") {
        try {
          compareAt = JSON.stringify(majorToStoredMoney(variant.compare_at_price, currency));
        } catch {
          warnings.push(`Product ${sourceFingerprint} variant ${variantFingerprint} has invalid compare-at price; value omitted`);
        }
      }

      skus.add(sku.toLocaleLowerCase("en-US"));
      const variantId = deterministicProviderId(SHOPIFY_PROVIDER, "variant", variantSourceId);
      const quantity = clampInventory(variant.inventory_quantity);
      const allowBackorder = variant.inventory_policy === "continue";
      const selectedMedia = variant.image_id === null || variant.image_id === undefined
        ? []
        : [mediaBySourceId.get(String(variant.image_id))].filter(Boolean);
      const optionValues = optionDefinitions.flatMap((option, optionIndex) => {
        const value = variant[`option${optionIndex + 1}` as "option1" | "option2" | "option3"]?.trim();
        return value ? [{ option_id: option.id, value }] : [];
      });
      const createdAt = isoTimestamp(variant.created_at, isoTimestamp(source.created_at, UNKNOWN_SOURCE_TIMESTAMP));
      const updatedAt = isoTimestamp(variant.updated_at, isoTimestamp(source.updated_at, UNKNOWN_SOURCE_TIMESTAMP));
      variants.push({
        id: variantId,
        product_id: productId,
        sku,
        status: variantStatus(status),
        position: boundedPositiveInteger(variant.position, MAX_PRODUCT_VARIANTS) ?? index + 1,
        option_values: JSON.stringify(optionValues),
        price: JSON.stringify(price),
        compare_at_price: compareAt,
        cost: null,
        weight: weight(variant),
        dimensions: null,
        barcode: variant.barcode?.trim() || null,
        inventory: JSON.stringify({
          track_inventory: Boolean(variant.inventory_management),
          quantity,
          allow_backorder: allowBackorder,
        }),
        tax_category: variant.taxable === false ? null : options.taxCategory?.trim() || null,
        shipping_required: variant.requires_shipping !== false,
        media: JSON.stringify(selectedMedia),
        attributes: JSON.stringify({
          shopify: {
            fulfillment_service: variant.fulfillment_service ?? null,
            taxable: variant.taxable ?? null,
          },
        }),
        created_at: createdAt,
        updated_at: updatedAt,
      });
      inventory.push({
        id: deterministicProviderId(SHOPIFY_PROVIDER, "inventory", `${variantFingerprint}:${locationId}`),
        sku_id: variantId,
        location_id: locationId,
        quantities: JSON.stringify({ on_hand: quantity, reserved: 0, available: quantity }),
        status: status === "active" ? "active" : "inactive",
        stock_status: quantity > 0 ? "in_stock" : allowBackorder ? "backorder" : "out_of_stock",
        external_references: JSON.stringify({
          shopify_fingerprint: variantFingerprint,
        }),
        created_at: createdAt,
        updated_at: updatedAt,
        policy_id: null,
        backorderable: allowBackorder,
        backorder_eta: null,
        safety_stock: 0,
        version: 0,
        extensions: "{}",
      });
    }

    if (variants.length === 0) {
      skipped.push({ record: source, reason: "Product has no importable variants" });
      continue;
    }
    slugs.add(slug);
    const categoryIds = uniqueStrings([...(options.categoryIdsByProduct?.get(sourceFingerprint) ?? [])]);
    if (
      categoryIds.length > MAX_PRODUCT_CATEGORIES ||
      categoryIds.some((categoryId) => categoryId.length > 200)
    ) {
      skipped.push({ record: source, reason: "Product category references exceed migration limits" });
      continue;
    }
    const embeddedMedia = imageResults.map(({ embedded }) => embedded);
    const seo = source.seo_title || source.seo_description
      ? { meta_title: source.seo_title?.trim() || name, meta_description: source.seo_description?.trim() || undefined }
      : null;
    const description = source.body_html ? JSON.stringify({ en: plainText(source.body_html) }) : null;
    const categoriesJson = categoryIds.length ? JSON.stringify(categoryIds) : null;
    const tagsJson = tags.length ? JSON.stringify(tags) : null;
    const optionsJson = optionDefinitions.length ? JSON.stringify(optionDefinitions) : null;
    const primaryImageJson = embeddedMedia[0] ? JSON.stringify(embeddedMedia[0]) : null;
    const mediaJson = embeddedMedia.length ? JSON.stringify(embeddedMedia) : null;
    const seoJson = seo ? JSON.stringify(seo) : null;
    const boundedJson = [description, categoriesJson, tagsJson, optionsJson, primaryImageJson, mediaJson, seoJson]
      .filter((value): value is string => value !== null);
    if (
      boundedJson.some((value) => !fitsEscapedSqlText(value)) ||
      boundedJson.reduce((total, value) => total + escapedSqlUtf8Bytes(value), 0) > 80 * 1024
    ) {
      skipped.push({ record: source, reason: "Product record exceeds SQL-safe text limits" });
      continue;
    }

    records.push({
      sourceFingerprint,
      variants,
      inventory,
      media: imageResults.map(({ plan }) => plan),
      product: {
        id: productId,
        name,
        description,
        type: source.product_type?.trim() || null,
        status,
        slug,
        brand: source.vendor?.trim() || null,
        categories: categoriesJson,
        tags: tagsJson,
        options: optionsJson,
        default_variant_id: variants[0].id,
        fulfillment_type: options.fulfillmentType,
        tax_category: options.taxCategory?.trim() || null,
        primary_image: primaryImageJson,
        media: mediaJson,
        seo: seoJson,
        rating: null,
        related_products: null,
        external_references: JSON.stringify({ shopify_fingerprint: sourceFingerprint }),
        extensions: JSON.stringify({ shopify: { product_type: source.product_type ?? null } }),
        created_at: isoTimestamp(source.created_at, UNKNOWN_SOURCE_TIMESTAMP),
        updated_at: isoTimestamp(source.updated_at, UNKNOWN_SOURCE_TIMESTAMP),
      },
    });
    idMap.set(sourceFingerprint, productId);
  }

  return { records, idMap, skipped, warnings };
}
