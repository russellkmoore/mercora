import type { ShopifyPage } from "../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  excerptFromHtml,
  isReservedPageSlug,
  normalizeSlug,
  requiredMigrationTime,
  rewriteAndSanitizeHtml,
  unixTimestamp,
  type MediaRewrite,
  type PureTransformResult,
} from "./_shared.js";

export interface PageInsertRecord {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  meta_title: string;
  meta_description: string | null;
  meta_keywords: null;
  status: "draft" | "published";
  published_at: number | null;
  template: string;
  parent_id: null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  version: 1;
  show_in_nav: 0;
  nav_title: null;
  custom_css: null;
  custom_js: null;
  is_protected: 0;
  required_roles: null;
}

export interface InitialPageVersionPlan {
  pageReference: { provider: typeof SHOPIFY_PROVIDER; sourceFingerprint: string; slug: string };
  record: {
    title: string;
    content: string;
    excerpt: string | null;
    meta_title: string;
    meta_description: string | null;
    meta_keywords: null;
    version: 1;
    change_summary: "Initial Shopify import";
    created_at: number;
    created_by: string;
  };
}

export interface PageTransformRecord {
  sourceFingerprint: string;
  page: PageInsertRecord;
  initialVersion: InitialPageVersionPlan;
  media: MediaRewrite[];
  conflict: { strategy: "insert-only"; key: "slug"; onConflict: "skip" };
}

export interface PageTransformOptions {
  generatedAt: string;
  actorId: string;
}

export function transformPages(
  pages: readonly ShopifyPage[],
  options: PageTransformOptions,
): PureTransformResult<ShopifyPage, PageTransformRecord> {
  const generatedAtIso = requiredMigrationTime(options.generatedAt);
  const generatedAt = unixTimestamp(generatedAtIso)!;
  const actorId = options.actorId.trim();
  if (!actorId) throw new TypeError("actorId is required for page version attribution");
  const records: PageTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const skipped: Array<{ record: ShopifyPage; reason: string }> = [];
  const warnings: string[] = [];
  const slugs = new Set<string>();

  for (const source of pages) {
    const sourceId = String(source.id ?? "").trim();
    const title = source.title?.trim();
    const slug = normalizeSlug(source.handle ?? "");
    if (!sourceId || !title || !slug) {
      skipped.push({ record: source, reason: "Page requires an id, title, and valid handle" });
      continue;
    }
    if (isReservedPageSlug(slug)) {
      skipped.push({ record: source, reason: `Page slug is reserved by the storefront: ${slug}` });
      continue;
    }
    if (slugs.has(slug)) {
      skipped.push({ record: source, reason: `Duplicate page slug: ${slug}` });
      continue;
    }
    slugs.add(slug);

    const pageReferenceId = deterministicProviderId(SHOPIFY_PROVIDER, "page", sourceId);
    const sourceFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "page", sourceId);
    const { html, media } = rewriteAndSanitizeHtml(source.body_html ?? "", pageReferenceId, "page-inline");
    const publishedAt = unixTimestamp(source.published_at);
    if (source.published_at && publishedAt === null) {
      warnings.push(`Page ${sourceFingerprint} has an invalid publication time and was imported as draft`);
    }
    const createdAt = unixTimestamp(source.created_at) ?? generatedAt;
    const updatedAt = unixTimestamp(source.updated_at) ?? generatedAt;
    const excerpt = excerptFromHtml(html);
    const page: PageInsertRecord = {
      title,
      slug,
      content: html,
      excerpt,
      meta_title: title,
      meta_description: excerpt,
      meta_keywords: null,
      status: publishedAt === null ? "draft" : "published",
      published_at: publishedAt,
      template: source.template_suffix?.trim() || "default",
      parent_id: null,
      sort_order: 0,
      created_at: createdAt,
      updated_at: updatedAt,
      created_by: actorId,
      updated_by: actorId,
      version: 1,
      show_in_nav: 0,
      nav_title: null,
      custom_css: null,
      custom_js: null,
      is_protected: 0,
      required_roles: null,
    };
    records.push({
      sourceFingerprint,
      page,
      media,
      conflict: { strategy: "insert-only", key: "slug", onConflict: "skip" },
      initialVersion: {
        pageReference: {
          provider: SHOPIFY_PROVIDER,
          sourceFingerprint,
          slug,
        },
        record: {
          title,
          content: html,
          excerpt,
          meta_title: title,
          meta_description: excerpt,
          meta_keywords: null,
          version: 1,
          change_summary: "Initial Shopify import",
          created_at: createdAt,
          created_by: actorId,
        },
      },
    });
    idMap.set(sourceFingerprint, slug);
  }
  return { records, idMap, skipped, warnings };
}
