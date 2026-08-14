import type { ShopifyRedirect } from "../lib/types.js";
import { providerFingerprint } from "../lib/ids.js";
import { SHOPIFY_PROVIDER, type TransformFailure } from "./_shared.js";

export type RedirectEntityType = "product" | "collection" | "page" | "blog" | "shopify-redirect";

export interface RedirectCandidate {
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 308;
  entityType: RedirectEntityType;
  sourceFingerprint?: string;
}

export interface PublicEntityRoute {
  /** The exact historical Shopify path segment, never a provider or Mercora ID. */
  legacyHandle: string;
  /** The verified public Mercora slug, never inferred from a generated entity ID. */
  publicSlug: string;
}

export interface RedirectTransformOptions {
  generated?: readonly RedirectCandidate[];
  protectedSourcePaths?: ReadonlySet<string>;
}

export interface RedirectTransformResult {
  records: RedirectCandidate[];
  idMap: Map<string, string>;
  skipped: Array<TransformFailure<ShopifyRedirect | RedirectCandidate>>;
  warnings: string[];
}

function validInternalPath(value: string, source: boolean): boolean {
  if (value.length < (source ? 3 : 1) || value.length > 2_048) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (/[\\?#\u0000-\u001f\u007f]/u.test(value)) return false;
  if (/%(?:00|0[ad]|2e|2f|5c)/iu.test(value)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return false;
  return !decoded.split("/").some((segment) => segment === "." || segment === "..");
}

function routeSegment(value: string): string {
  const segment = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(segment)) {
    throw new Error(`Invalid public route segment: ${value}`);
  }
  return segment;
}

export function productRedirects(routes: readonly PublicEntityRoute[]): RedirectCandidate[] {
  return routes.map(({ legacyHandle, publicSlug }) => ({
    sourcePath: `/products/${routeSegment(legacyHandle)}`,
    targetPath: `/product/${routeSegment(publicSlug)}`,
    statusCode: 301,
    entityType: "product",
  }));
}

export function collectionRedirects(routes: readonly PublicEntityRoute[]): RedirectCandidate[] {
  return routes.map(({ legacyHandle, publicSlug }) => ({
    sourcePath: `/collections/${routeSegment(legacyHandle)}`,
    targetPath: `/category/${routeSegment(publicSlug)}`,
    statusCode: 301,
    entityType: "collection",
  }));
}

export function pageRedirects(routes: readonly PublicEntityRoute[]): RedirectCandidate[] {
  return routes.map(({ legacyHandle, publicSlug }) => ({
    sourcePath: `/pages/${routeSegment(legacyHandle)}`,
    targetPath: `/${routeSegment(publicSlug)}`,
    statusCode: 301,
    entityType: "page",
  }));
}

function cyclicSources(records: readonly RedirectCandidate[]): Set<string> {
  const next = new Map(records.map((record) => [record.sourcePath, record.targetPath]));
  const cyclic = new Set<string>();
  for (const start of next.keys()) {
    const order: string[] = [];
    const indexes = new Map<string, number>();
    let current: string | undefined = start;
    while (current && next.has(current)) {
      const prior = indexes.get(current);
      if (prior !== undefined) {
        order.slice(prior).forEach((path) => cyclic.add(path));
        break;
      }
      indexes.set(current, order.length);
      order.push(current);
      current = next.get(current);
    }
  }
  for (const start of next.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = start;
    while (current && next.has(current) && !visited.has(current)) {
      if (cyclic.has(current)) {
        visited.forEach((path) => cyclic.add(path));
        break;
      }
      visited.add(current);
      current = next.get(current);
    }
  }
  return cyclic;
}

export function transformRedirects(
  redirects: readonly ShopifyRedirect[],
  options: RedirectTransformOptions = {},
): RedirectTransformResult {
  const skipped: Array<TransformFailure<ShopifyRedirect | RedirectCandidate>> = [];
  const warnings: string[] = [];
  const idMap = new Map<string, string>();
  const candidates: Array<{ source: ShopifyRedirect | RedirectCandidate; record: RedirectCandidate }> = [];

  for (const source of redirects) {
    const fingerprint = providerFingerprint(SHOPIFY_PROVIDER, "redirect", source.id);
    const record: RedirectCandidate = {
      sourcePath: source.path.trim(),
      targetPath: source.target.trim(),
      statusCode: 301,
      entityType: "shopify-redirect",
      sourceFingerprint: fingerprint,
    };
    candidates.push({ source, record });
  }
  for (const record of options.generated ?? []) candidates.push({ source: record, record: { ...record } });

  const valid = candidates.filter(({ source, record }) => {
    if (!validInternalPath(record.sourcePath, true) || !validInternalPath(record.targetPath, false)) {
      skipped.push({ record: source, reason: "Redirect source and target must be safe internal paths" });
      return false;
    }
    if (record.sourcePath === record.targetPath) {
      skipped.push({ record: source, reason: "Redirect cannot target itself" });
      return false;
    }
    if (options.protectedSourcePaths?.has(record.sourcePath)) {
      skipped.push({ record: source, reason: `Redirect source collides with a protected storefront path: ${record.sourcePath}` });
      return false;
    }
    return true;
  });

  const bySource = new Map<string, typeof valid>();
  valid.forEach((candidate) => {
    const matches = bySource.get(candidate.record.sourcePath) ?? [];
    matches.push(candidate);
    bySource.set(candidate.record.sourcePath, matches);
  });

  const deduplicated: typeof valid = [];
  for (const [sourcePath, matches] of bySource) {
    const destinations = new Set(matches.map(({ record }) => `${record.targetPath}\0${record.statusCode}`));
    if (destinations.size > 1) {
      matches.forEach(({ source }) => skipped.push({
        record: source,
        reason: `Redirect source has conflicting targets: ${sourcePath}`,
      }));
      continue;
    }
    deduplicated.push(matches[0]);
    if (matches.length > 1) warnings.push(`Removed ${matches.length - 1} duplicate redirect(s) for ${sourcePath}`);
  }

  const cycles = cyclicSources(deduplicated.map(({ record }) => record));
  const records = deduplicated.flatMap(({ source, record }) => {
    if (!cycles.has(record.sourcePath)) return [record];
    skipped.push({ record: source, reason: `Redirect participates in a cycle: ${record.sourcePath}` });
    return [];
  }).sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

  for (const record of records) {
    if (record.sourceFingerprint) idMap.set(record.sourceFingerprint, record.sourcePath);
  }

  return { records, idMap, skipped, warnings };
}
