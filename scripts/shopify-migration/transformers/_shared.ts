import { isIP } from "node:net";

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
  sourceHost: string;
  objectKey: string;
  publicPath: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  role: "product" | "category" | "page-inline" | "blog-cover" | "blog-inline";
  ownerId: string;
  requiredBeforePersistence: true;
  altText?: string;
  width?: number;
  height?: number;
}

export type MediaHostAllowlist = ReadonlySet<string>;

const MAX_MEDIA_HOSTS = 16;
const MAX_INLINE_MEDIA = 100;
export const MAX_SQL_TEXT_BYTES = 48 * 1024;
const DNS_HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/** Normalize a small exact-host allowlist. Empty explicitly disables media import. */
export function mediaHostAllowlist(hosts: readonly string[]): MediaHostAllowlist {
  if (!Array.isArray(hosts) || hosts.length > MAX_MEDIA_HOSTS) {
    throw new TypeError(`allowedMediaHosts must contain at most ${MAX_MEDIA_HOSTS} exact hostnames`);
  }
  const normalized = new Set<string>();
  for (const raw of hosts) {
    const value = raw.trim();
    if (!value || value.includes("://") || /[/\\@:#?%\[\]]/u.test(value)) {
      throw new TypeError(`Invalid allowed media hostname: ${raw}`);
    }
    let hostname: string;
    try {
      hostname = new URL(`https://${value}`).hostname.toLowerCase();
    } catch {
      throw new TypeError(`Invalid allowed media hostname: ${raw}`);
    }
    if (
      !DNS_HOSTNAME.test(hostname) || isIP(hostname) !== 0 || hostname === "localhost" ||
      hostname.endsWith(".localhost")
    ) {
      throw new TypeError(`Invalid allowed media hostname: ${raw}`);
    }
    normalized.add(hostname);
  }
  return normalized;
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

export function boundedPositiveInteger(value: unknown, maximum = 100_000): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum
    ? value
    : undefined;
}

/** Bytes consumed after Wrangler SQL literal escaping doubles apostrophes. */
export function escapedSqlUtf8Bytes(value: string): number {
  const apostrophes = value.match(/'/gu)?.length ?? 0;
  return new TextEncoder().encode(value).byteLength + apostrophes;
}

export function fitsEscapedSqlText(value: string, maximum = MAX_SQL_TEXT_BYTES): boolean {
  return escapedSqlUtf8Bytes(value) <= maximum;
}

function safeExtension(sourceUrl: string): string | null {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const extension = pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
    return extension && ["jpeg", "jpg", "png", "webp"].includes(extension)
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

function safeSourceUrl(
  value: string,
  allowedHosts: MediaHostAllowlist,
): { href: string; hostname: string } | null {
  if (value.length > 2_048) return null;
  const authority = /^https:\/\/([^/?#]+)/iu.exec(value)?.[1];
  if (!authority || authority.includes(":") || authority.includes("@")) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" || url.username || url.password || url.port || isIP(hostname) !== 0 ||
      hostname === "localhost" || hostname.endsWith(".localhost") || !allowedHosts.has(hostname)
    ) return null;
    return { href: url.href, hostname };
  } catch {
    return null;
  }
}

export function mediaRewrite(
  source: string,
  allowedHosts: MediaHostAllowlist,
  ownerId: string,
  role: MediaRewrite["role"],
  position: number,
  metadata: Pick<MediaRewrite, "altText" | "width" | "height"> = {},
): MediaRewrite | null {
  const sourceUrl = safeSourceUrl(source, allowedHosts);
  if (!sourceUrl) return null;
  const extension = safeExtension(sourceUrl.href);
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
    sourceUrl: sourceUrl.href,
    sourceHost: sourceUrl.hostname,
    objectKey,
    publicPath: `/media/${objectKey}`,
    contentType: imageContentType(extension),
    role,
    ownerId,
    requiredBeforePersistence: true,
    ...metadata,
  };
}

/** Rewrite remote image sources to the future local object path before sanitizing. */
export function rewriteAndSanitizeHtml(
  html: string,
  allowedHosts: MediaHostAllowlist,
  ownerId: string,
  role: "page-inline" | "blog-inline",
): { html: string; media: MediaRewrite[] } {
  const media: MediaRewrite[] = [];
  let position = 0;
  const rewritten = html.replace(
    /<img\b[^>]*>/giu,
    (tag) => {
      const sourceAttributes = [...tag.matchAll(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)];
      if (sourceAttributes.length === 0) return tag;
      if (sourceAttributes.length !== 1) return "";
      const sourceAttribute = sourceAttributes[0];
      const source = sourceAttribute[1] ?? sourceAttribute[2] ?? sourceAttribute[3] ?? "";
      position += 1;
      const plan = position <= MAX_INLINE_MEDIA
        ? mediaRewrite(source, allowedHosts, ownerId, role, position)
        : null;
      if (!plan) return "";
      media.push(plan);
      return tag.replace(sourceAttribute[0], `src="${plan.publicPath}"`);
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
