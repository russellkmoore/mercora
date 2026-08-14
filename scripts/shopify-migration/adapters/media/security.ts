import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { MediaRewrite } from "../../transformers/_shared.js";

export const DEFAULT_MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MEDIA_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_REDIRECTS = 4;

export type MediaContentType = "image/jpeg" | "image/png" | "image/webp";
export type HostResolver = (hostname: string) => Promise<readonly string[]>;

export interface MediaDownloadOptions {
  allowedHosts: readonly string[];
  fetcher?: typeof fetch;
  resolveHost?: HostResolver;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface VerifiedMedia {
  bytes: Uint8Array;
  contentType: MediaContentType;
  objectKey: string;
  publicPath: string;
}

const blockedAddresses = new BlockList();
const MYSHOPIFY_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/u;

function isShopifyAssetHost(hostname: string): boolean {
  return hostname === "cdn.shopify.com" || MYSHOPIFY_HOST.test(hostname);
}
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedAddresses.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) blockedAddresses.addSubnet(address, prefix, "ipv6");

function positiveInteger(value: number | undefined, fallback: number, maximum: number, field: string): number {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual < 1 || actual > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}`);
  }
  return actual;
}

export async function resolvePublicAddresses(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
}

export function assertPublicAddresses(addresses: readonly string[]): void {
  if (addresses.length === 0) throw new Error("Media hostname did not resolve");
  for (const address of addresses) {
    const family = isIP(address);
    if (family === 0 || address.toLowerCase().startsWith("::ffff:") || blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6")) {
      throw new Error("Media hostname resolved to a non-public address");
    }
  }
}

function allowedHostnames(hosts: readonly string[]): ReadonlySet<string> {
  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.length > 16) {
    throw new Error("Media import requires 1-16 exact allowed hostnames");
  }
  const result = new Set<string>();
  for (const raw of hosts) {
    if (!raw || raw.includes("://") || /[/\\@:#?%\[\]*]/u.test(raw)) throw new Error("Invalid allowed media hostname");
    const hostname = new URL(`https://${raw}`).hostname.toLowerCase();
    if (
      hostname !== raw.toLowerCase() || isIP(hostname) !== 0 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(hostname) ||
      !isShopifyAssetHost(hostname)
    ) {
      throw new Error("Invalid or non-Shopify allowed media hostname");
    }
    result.add(hostname);
  }
  return result;
}

function mediaUrl(value: string, allowed: ReadonlySet<string>): URL {
  if (value.length > 2_048) throw new Error("Media URL is too long");
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
    isIP(hostname) !== 0 || !allowed.has(hostname) || !isShopifyAssetHost(hostname) ||
    (MYSHOPIFY_HOST.test(hostname) && !url.pathname.startsWith("/cdn/"))
  ) throw new Error("Media URL is not an allowed exact HTTPS origin");
  return url;
}

async function resolveWithTimeout(resolver: HostResolver, hostname: string, timeoutMs: number): Promise<readonly string[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Media DNS resolution timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function expectedPlanShape(plan: MediaRewrite): { contentType: MediaContentType; extension: string } {
  if (plan.requiredBeforePersistence !== true) throw new Error("Media rewrite must be completed before record persistence");
  const rolePath = plan.role === "product" ? "products"
    : plan.role === "category" ? "categories"
      : plan.role === "page-inline" ? "pages"
        : "blog";
  const roleSegment = plan.role === "page-inline" || plan.role === "blog-inline" ? "/inline"
    : plan.role === "blog-cover" ? "/cover"
      : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(plan.ownerId)) throw new Error("Media owner ID is unsafe");
  const match = /\/([1-9][0-9]{0,5})\.(jpe?g|png|webp)$/i.exec(plan.objectKey);
  if (!match) throw new Error("Media object key has an unsupported or unsafe extension");
  if (plan.objectKey !== plan.objectKey.toLowerCase()) throw new Error("Media object key must be canonical lowercase");
  const extension = match[2].toLowerCase();
  const expectedPrefix = `${rolePath}/${plan.ownerId}${roleSegment}/`;
  if (!plan.objectKey.startsWith(expectedPrefix) || plan.objectKey !== `${expectedPrefix}${match[1]}.${match[2]}`) {
    throw new Error("Media object key does not match its deterministic role and owner path");
  }
  if (plan.publicPath !== `/media/${plan.objectKey}`) throw new Error("Media public path does not match its object key");
  const contentType: MediaContentType = extension === "jpg" || extension === "jpeg" ? "image/jpeg"
    : extension === "png" ? "image/png"
      : "image/webp";
  if (plan.contentType !== contentType) throw new Error("Media plan extension and content type disagree");
  return { contentType, extension };
}

export function validateMediaPlan(plan: MediaRewrite, allowedHosts: readonly string[]): URL {
  const allowed = allowedHostnames(allowedHosts);
  expectedPlanShape(plan);
  const url = mediaUrl(plan.sourceUrl, allowed);
  if (plan.sourceHost.toLowerCase() !== url.hostname.toLowerCase()) throw new Error("Media plan source host does not match its URL");
  return url;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.length >= 33 && signature.every((byte, index) => bytes[index] === byte) &&
    bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13 &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR" &&
    bytes.slice(16, 20).some((byte) => byte !== 0) && bytes.slice(20, 24).some((byte) => byte !== 0) &&
    bytes[26] === 0 && bytes[27] === 0 && bytes[28] <= 1;
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  let dimensions = false;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) return dimensions;
    if (marker === 0xda) {
      for (let index = offset; index + 1 < bytes.length; index += 1) {
        if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return dimensions;
      }
      return false;
    }
    if (offset + 1 >= bytes.length) return false;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8 || bytes[offset + 3] === 0 && bytes[offset + 4] === 0 || bytes[offset + 5] === 0 && bytes[offset + 6] === 0) return false;
      dimensions = true;
    }
    offset += length;
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return false;
  const chunk = ascii(bytes, 12, 16);
  const chunkLength = view.getUint32(16, true);
  return ["VP8 ", "VP8L", "VP8X"].includes(chunk) && 20 + chunkLength + (chunkLength % 2) <= bytes.length;
}

export function verifyImageSignature(bytes: Uint8Array, contentType: MediaContentType): void {
  const valid = contentType === "image/jpeg" ? isJpeg(bytes)
    : contentType === "image/png" ? isPng(bytes)
      : isWebp(bytes);
  if (!valid) throw new Error("Downloaded media signature does not match its declared image type");
}

async function boundedBody(response: Response, maxBytes: number, expired: Promise<never>): Promise<Uint8Array> {
  if (!response.body) throw new Error("Media response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error(`Media response exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function downloadVerifiedMedia(plan: MediaRewrite, options: MediaDownloadOptions): Promise<VerifiedMedia> {
  const maxBytes = positiveInteger(options.maxBytes, DEFAULT_MAX_MEDIA_BYTES, 100 * 1024 * 1024, "maxBytes");
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_MEDIA_TIMEOUT_MS, 120_000, "timeoutMs");
  const maxRedirects = positiveInteger((options.maxRedirects ?? DEFAULT_MAX_REDIRECTS) + 1, DEFAULT_MAX_REDIRECTS + 1, 11, "maxRedirects") - 1;
  const allowed = allowedHostnames(options.allowedHosts);
  const expected = expectedPlanShape(plan);
  let url = mediaUrl(plan.sourceUrl, allowed);
  if (plan.sourceHost.toLowerCase() !== url.hostname) throw new Error("Media plan source host does not match its URL");
  const resolver = options.resolveHost ?? resolvePublicAddresses;
  const fetcher = options.fetcher ?? fetch;

  for (let redirects = 0; ; redirects += 1) {
    assertPublicAddresses(await resolveWithTimeout(resolver, url.hostname, timeoutMs));
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("Media download timed out"));
      }, timeoutMs);
    });
    try {
      const request = fetcher(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/jpeg, image/png, image/webp" },
      });
      void request.then((lateResponse) => {
        if (controller.signal.aborted) void lateResponse.body?.cancel().catch(() => undefined);
      }).catch(() => undefined);
      const response = await Promise.race([
        request,
        expired,
      ]);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects >= maxRedirects) throw new Error("Media redirect limit exceeded");
        const location = response.headers.get("location");
        if (!location) throw new Error("Media redirect has no Location header");
        url = mediaUrl(new URL(location, url).href, allowed);
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Media download failed with HTTP ${response.status}`); }
      if (response.headers.get("content-encoding") && response.headers.get("content-encoding") !== "identity") {
        await response.body?.cancel();
        throw new Error("Encoded media responses are not accepted");
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== expected.contentType) { await response.body?.cancel(); throw new Error("Media Content-Type does not match its plan"); }
      const declaredLength = response.headers.get("content-length");
      if (declaredLength && (!/^(?:0|[1-9][0-9]*)$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
        await response.body?.cancel();
        throw new Error("Media Content-Length is invalid or exceeds the byte limit");
      }
      const bytes = await boundedBody(response, maxBytes, expired);
      if (declaredLength && Number(declaredLength) !== bytes.byteLength) throw new Error("Media Content-Length does not match the response body");
      verifyImageSignature(bytes, expected.contentType);
      return { bytes, contentType: expected.contentType, objectKey: plan.objectKey, publicPath: plan.publicPath };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
