import type {
  ShopifyArticle,
  ShopifyBlog,
  ShopifyCollect,
  ShopifyCollection,
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyPage,
  ShopifyProduct,
  ShopifyRedirect,
} from "./types.js";
import { validateShopifyApiVersion, validateShopifyOrigin } from "./config.js";

const DEFAULT_MAX_PAGES = 200;
const DEFAULT_MAX_RECORDS = 50_000;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;

const PUBLIC_RESOURCES = new Set([
  "blogs.json",
  "collects.json",
  "custom_collections.json",
  "pages.json",
  "products.json",
  "redirects.json",
  "smart_collections.json",
]);
const SENSITIVE_RESOURCES = new Set(["customers.json", "orders.json"]);

function assertSupportedResource(resource: string, includeSensitive: boolean): void {
  const articleResource = /^blogs\/\d+\/articles\.json$/u.test(resource);
  if (SENSITIVE_RESOURCES.has(resource)) {
    if (!includeSensitive) throw new Error("Sensitive Shopify extraction requires confirmed sensitive-data access");
    return;
  }
  if (!PUBLIC_RESOURCES.has(resource) && !articleResource) {
    throw new Error("Shopify resource is not supported by this migration toolkit");
  }
}

export interface ShopifyClientOptions {
  origin: string;
  accessToken: string;
  apiVersion: string;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPages?: number;
  maxRecords?: number;
  maxRetries?: number;
  maxRetryAfterMs?: number;
  includeSensitive?: boolean;
}

export interface PaginationOptions {
  query?: Readonly<Record<string, string | number | boolean>>;
  pageSize?: number;
  maxPages?: number;
  maxRecords?: number;
}

function boundedInteger(value: number, name: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function splitLinkHeader(header: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let inAngle = false;
  let inQuote = false;
  let escaped = false;
  for (let index = 0; index < header.length; index += 1) {
    const character = header[index];
    if (escaped) { escaped = false; continue; }
    if (inQuote && character === "\\") { escaped = true; continue; }
    if (character === '"' && !inAngle) inQuote = !inQuote;
    else if (character === "<" && !inQuote) inAngle = true;
    else if (character === ">" && !inQuote) inAngle = false;
    else if (character === "," && !inAngle && !inQuote) {
      parts.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (inAngle || inQuote || escaped) throw new Error("Malformed Shopify Link header");
  parts.push(header.slice(start).trim());
  return parts.filter(Boolean);
}

export function parseNextLink(header: string | null, currentUrl: URL): URL | undefined {
  if (!header) return undefined;
  const matches: URL[] = [];
  for (const part of splitLinkHeader(header)) {
    const target = /^<([^<>]+)>/.exec(part)?.[1];
    if (!target) throw new Error("Malformed Shopify Link header target");
    const parameters = part.slice(part.indexOf(">") + 1).split(";").map((item) => item.trim()).filter(Boolean);
    let next = false;
    for (const parameter of parameters) {
      const match = /^rel\s*=\s*(?:"([^"]*)"|([^\s;]+))$/i.exec(parameter);
      if (match && (match[1] ?? match[2]).toLowerCase().split(/\s+/).includes("next")) next = true;
    }
    if (next) matches.push(new URL(target, currentUrl));
  }
  if (matches.length > 1) throw new Error("Shopify Link header contains multiple rel=next targets");
  return matches[0];
}

function retryAfterMilliseconds(value: string | null, now = Date.now()): number {
  if (!value) return 1_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 1_000;
}

export class ShopifyClient {
  readonly origin: string;
  readonly apiVersion: string;
  private readonly accessToken: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxPages: number;
  private readonly maxRecords: number;
  private readonly maxRetries: number;
  private readonly maxRetryAfterMs: number;
  private readonly includeSensitive: boolean;
  private readonly apiPathPrefix: string;

  constructor(options: ShopifyClientOptions) {
    this.origin = validateShopifyOrigin(options.origin);
    this.apiVersion = validateShopifyApiVersion(options.apiVersion);
    if (!options.accessToken.trim()) throw new Error("Shopify access token is required");
    this.accessToken = options.accessToken;
    this.fetcher = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxPages = boundedInteger(options.maxPages ?? DEFAULT_MAX_PAGES, "maxPages", 10_000);
    this.maxRecords = boundedInteger(options.maxRecords ?? DEFAULT_MAX_RECORDS, "maxRecords", 1_000_000);
    this.maxRetries = boundedInteger((options.maxRetries ?? DEFAULT_MAX_RETRIES) + 1, "maxRetries", 21) - 1;
    this.maxRetryAfterMs = boundedInteger(options.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS, "maxRetryAfterMs", 300_000);
    this.includeSensitive = options.includeSensitive === true;
    this.apiPathPrefix = `/admin/api/${this.apiVersion}/`;
  }

  private assertAllowedUrl(url: URL): void {
    if (
      url.origin !== this.origin ||
      !url.pathname.startsWith(this.apiPathPrefix) ||
      /%2e|%2f|%5c/i.test(url.pathname) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new Error("Shopify pagination target escaped the configured Admin API origin or version path");
    }
  }

  private async request(url: URL): Promise<Response> {
    this.assertAllowedUrl(url);
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetcher(url, {
        method: "GET",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
      });
      if (response.status !== 429) {
        if (!response.ok) throw new Error(`Shopify API request failed with HTTP ${response.status}`);
        return response;
      }
      if (attempt >= this.maxRetries) throw new Error("Shopify API rate limit retry budget exhausted");
      const delay = Math.min(retryAfterMilliseconds(response.headers.get("retry-after")), this.maxRetryAfterMs);
      await response.body?.cancel();
      await this.sleep(delay);
    }
  }

  async fetchPaginated<T>(resource: string, key: string, options: PaginationOptions = {}): Promise<T[]> {
    if (!/^[a-z][a-z0-9_-]*(?:\/[a-z0-9_-]+)*\.json$/.test(resource)) {
      throw new Error("Shopify resource must be a safe relative JSON endpoint");
    }
    assertSupportedResource(resource, this.includeSensitive);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error("Shopify response key is invalid");
    const pageSize = boundedInteger(options.pageSize ?? 250, "pageSize", 250);
    const maxPages = boundedInteger(options.maxPages ?? this.maxPages, "maxPages", this.maxPages);
    const maxRecords = boundedInteger(options.maxRecords ?? this.maxRecords, "maxRecords", this.maxRecords);
    let next = new URL(`${this.apiPathPrefix}${resource}`, this.origin);
    next.searchParams.set("limit", String(pageSize));
    for (const [name, value] of Object.entries(options.query ?? {})) next.searchParams.set(name, String(value));

    const visited = new Set<string>();
    const records: T[] = [];
    let pages = 0;
    while (next) {
      this.assertAllowedUrl(next);
      if (visited.has(next.href)) throw new Error("Shopify pagination cycle detected");
      if (pages >= maxPages) throw new Error(`Shopify pagination exceeded ${maxPages} pages`);
      visited.add(next.href);
      pages += 1;

      const response = await this.request(next);
      const payload: unknown = await response.json();
      const page = payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
      if (!Array.isArray(page)) throw new Error(`Shopify response did not contain an array at ${key}`);
      if (records.length + page.length > maxRecords) throw new Error(`Shopify pagination exceeded ${maxRecords} records`);
      records.push(...(page as T[]));

      const candidate = parseNextLink(response.headers.get("link"), next);
      if (!candidate) break;
      this.assertAllowedUrl(candidate);
      next = candidate;
    }
    return records;
  }

  fetchProducts(options?: PaginationOptions): Promise<ShopifyProduct[]> {
    return this.fetchPaginated("products.json", "products", options);
  }
  fetchCollections(options?: PaginationOptions): Promise<ShopifyCollection[]> {
    return Promise.all([
      this.fetchPaginated<ShopifyCollection>("custom_collections.json", "custom_collections", options),
      this.fetchPaginated<ShopifyCollection>("smart_collections.json", "smart_collections", options),
    ]).then(([custom, smart]) => [
      ...custom.map((collection) => ({ ...collection, collection_type: "custom" as const })),
      ...smart.map((collection) => ({ ...collection, collection_type: "smart" as const })),
    ]);
  }
  fetchCollects(options?: PaginationOptions): Promise<ShopifyCollect[]> {
    return this.fetchPaginated("collects.json", "collects", options);
  }
  fetchCustomers(options?: PaginationOptions): Promise<ShopifyCustomer[]> {
    if (!this.includeSensitive) throw new Error("Customer extraction requires confirmed sensitive-data access");
    return this.fetchPaginated("customers.json", "customers", options);
  }
  fetchOrders(options: PaginationOptions = {}): Promise<ShopifyOrder[]> {
    if (!this.includeSensitive) throw new Error("Order extraction requires confirmed sensitive-data access");
    return this.fetchPaginated("orders.json", "orders", {
      ...options,
      query: { ...options.query, status: "any" },
    });
  }
  fetchPages(options?: PaginationOptions): Promise<ShopifyPage[]> {
    return this.fetchPaginated("pages.json", "pages", options);
  }
  fetchBlogs(options?: PaginationOptions): Promise<ShopifyBlog[]> {
    return this.fetchPaginated("blogs.json", "blogs", options);
  }
  fetchArticles(blogId: string | number, options?: PaginationOptions): Promise<ShopifyArticle[]> {
    const id = String(blogId);
    if (!/^\d+$/.test(id)) throw new Error("Shopify blog ID must be numeric");
    return this.fetchPaginated(`blogs/${id}/articles.json`, "articles", options);
  }
  fetchRedirects(options?: PaginationOptions): Promise<ShopifyRedirect[]> {
    return this.fetchPaginated("redirects.json", "redirects", options);
  }
}
