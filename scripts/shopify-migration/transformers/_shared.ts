import { CURRENCY_PRECISION } from "../../../lib/money/currencies.js";
import { Money, type StoredMoney } from "../../../lib/money/money.js";
import { sanitizeRichHtmlServer } from "../../../lib/utils/sanitize-html-core.js";

export const SHOPIFY_PROVIDER = "shopify";

// Kept identical to the O02 public CMS route reservation contract.
const RESERVED_PAGE_SLUGS = new Set([
  "account", "admin", "api", "blog", "cart", "category", "checkout",
  "order-status", "orders", "product", "robots.txt", "sign-in", "sign-up",
  "sitemap.xml",
]);

export function isReservedPageSlug(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.has(slug.trim().toLowerCase());
}

export interface MediaRewrite {
  sourceUrl: string;
  objectKey: string;
  publicPath: string;
  contentType: "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp";
  role: "product" | "category" | "page-inline" | "blog-cover" | "blog-inline";
  ownerId: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface TransformFailure<T> {
  record: T;
  reason: string;
}

export interface PureTransformResult<TSource, TRecord> {
  records: TRecord[];
  idMap: Map<string, string>;
  skipped: Array<TransformFailure<TSource>>;
  warnings: string[];
}

export function requiredMigrationTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("generatedAt must be a valid ISO 8601 timestamp");
  }
  return new Date(timestamp).toISOString();
}

export function isoTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function unixTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1_000) : null;
}

export function hasValidTimestamp(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

export function requireSupportedCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!(normalized in CURRENCY_PRECISION)) {
    throw new RangeError(`Unsupported migration currency: ${currency}`);
  }
  return normalized;
}

export function majorToStoredMoney(value: string | number, currency: string): StoredMoney {
  const normalized = requireSupportedCurrency(currency);
  const money = Money.fromMajor(value, normalized);
  if (money.isNegative()) throw new RangeError("Money amounts cannot be negative");
  return money.toJSON();
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((raw) => {
    const value = raw.trim();
    const key = value.toLocaleLowerCase("en-US");
    if (!value || seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

export function clampInventory(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(value)));
}

function safeExtension(sourceUrl: string): string | null {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const extension = pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
    return extension && ["avif", "gif", "jpeg", "jpg", "png", "webp"].includes(extension)
      ? extension
      : null;
  } catch {
    return null;
  }
}

function imageContentType(extension: string): MediaRewrite["contentType"] {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return `image/${extension}` as MediaRewrite["contentType"];
}

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function mediaRewrite(
  source: string,
  ownerId: string,
  role: MediaRewrite["role"],
  position: number,
  metadata: Pick<MediaRewrite, "altText" | "width" | "height"> = {},
): MediaRewrite | null {
  const sourceUrl = safeSourceUrl(source);
  if (!sourceUrl) return null;
  const extension = safeExtension(sourceUrl);
  if (!extension) return null;
  const prefix = role === "product" ? "products"
    : role === "category" ? "categories"
      : role.startsWith("blog") ? "blog"
        : "pages";
  const roleSegment = role === "blog-cover" ? "/cover"
    : role === "blog-inline" || role === "page-inline" ? "/inline"
      : "";
  const objectKey = `${prefix}/${ownerId}${roleSegment}/${position}.${extension}`;
  return {
    sourceUrl,
    objectKey,
    publicPath: `/media/${objectKey}`,
    contentType: imageContentType(extension),
    role,
    ownerId,
    ...metadata,
  };
}

/** Rewrite remote image sources to the future local object path before sanitizing. */
export function rewriteAndSanitizeHtml(
  html: string,
  ownerId: string,
  role: "page-inline" | "blog-inline",
): { html: string; media: MediaRewrite[] } {
  const media: MediaRewrite[] = [];
  let position = 0;
  const rewritten = html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/giu,
    (match, prefix: string, quote: string, source: string) => {
      const plan = mediaRewrite(source, ownerId, role, ++position);
      if (!plan) return match;
      media.push(plan);
      return `${prefix}${quote}${plan.publicPath}${quote}`;
    },
  );
  return { html: sanitizeRichHtmlServer(rewritten), media };
}

export function plainText(html: string): string {
  return sanitizeRichHtmlServer(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptFromHtml(html: string, maxLength = 160): string | null {
  const value = plainText(html);
  if (!value) return null;
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
