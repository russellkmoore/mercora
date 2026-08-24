import { calculateBlogReadingTime, normalizeBlogTags } from "../../../lib/blog/values.js";
import type { ShopifyArticle, ShopifyBlog } from "../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  UNKNOWN_SOURCE_UNIX_TIMESTAMP,
  boundedPositiveInteger,
  canonicalProviderRecords,
  excerptFromHtml,
  fitsEscapedSqlText,
  mediaHostAllowlist,
  mediaRewrite,
  normalizeSlug,
  requiredMigrationTime,
  rewriteAndSanitizeHtml,
  unixTimestamp,
  type MediaRewrite,
  type TransformFailure,
} from "./_shared.js";

export interface BlogCategoryPlan {
  sourceFingerprint: string;
  record: {
    name: string;
    slug: string;
    description: null;
    created_at: number;
    updated_at: number;
  };
  conflict: { strategy: "insert-only"; key: "slug"; onConflict: "reuse" };
}

export interface BlogPostPlan {
  sourceFingerprint: string;
  categoryReference: { provider: typeof SHOPIFY_PROVIDER; sourceFingerprint: string; slug: string };
  record: {
    title: string;
    slug: string;
    author: string;
    excerpt: string | null;
    tags: string;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    status: "draft" | "published";
    editor_json: null;
    html: string;
    reading_time: number;
    meta_title: string;
    meta_description: string | null;
    published_at: number | null;
    created_at: number;
    updated_at: number;
    created_by: string;
    updated_by: string;
  };
  media: MediaRewrite[];
  redirect: {
    sourcePath: string;
    targetPath: string;
    statusCode: 301;
    entityType: "blog";
  };
  conflict: { strategy: "insert-only"; key: "slug"; onConflict: "skip" };
}

export interface BlogTransformOptions {
  generatedAt: string;
  actorId: string;
  fallbackAuthor: string;
  allowedMediaHosts: readonly string[];
}

export interface BlogTransformResult {
  categories: BlogCategoryPlan[];
  records: BlogPostPlan[];
  idMap: Map<string, string>;
  categoryIdMap: Map<string, string>;
  skipped: Array<TransformFailure<ShopifyBlog | ShopifyArticle>>;
  warnings: string[];
}

export function transformBlogContent(
  blogs: readonly ShopifyBlog[],
  articles: readonly ShopifyArticle[],
  options: BlogTransformOptions,
): BlogTransformResult {
  requiredMigrationTime(options.generatedAt);
  const actorId = options.actorId.trim();
  const fallbackAuthor = options.fallbackAuthor.trim();
  const allowedMediaHosts = mediaHostAllowlist(options.allowedMediaHosts);
  if (!actorId || actorId.length > 255) throw new TypeError("actorId must be 1-255 characters for blog attribution");
  if (!fallbackAuthor || fallbackAuthor.length > 160) throw new TypeError("fallbackAuthor must be 1-160 characters");

  const categories: BlogCategoryPlan[] = [];
  const records: BlogPostPlan[] = [];
  const idMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();
  const skipped: Array<TransformFailure<ShopifyBlog | ShopifyArticle>> = [];
  const warnings: string[] = [];
  const blogByFingerprint = new Map<string, { slug: string; handle: string }>();
  const blogHandleByFingerprint = new Map<string, string>();
  const blogSourceByFingerprint = new Map<string, ShopifyBlog>();
  const articleSourceByFingerprint = new Map<string, ShopifyArticle>();

  const canonicalBlogs = canonicalProviderRecords(blogs, "blog", (blog) => blog.id);
  for (const blog of canonicalBlogs.records) {
    const sourceId = String(blog.id ?? "").trim();
    const name = blog.title?.trim();
    const slug = normalizeSlug(blog.handle ?? "");
    const exactHandle = blog.handle?.trim();
    if (
      !sourceId || sourceId.length > 256 || !name || name.length > 120 || !slug || slug.length > 160 ||
      exactHandle !== slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exactHandle)
    ) {
      skipped.push({ record: blog, reason: "Blog requires an id, title, and valid handle" });
      continue;
    }
    const fingerprint = providerFingerprint(SHOPIFY_PROVIDER, "blog", sourceId);
    if (canonicalBlogs.duplicateFingerprints.has(fingerprint)) {
      skipped.push({ record: blog, reason: "Duplicate blog source identity" });
      continue;
    }
    blogHandleByFingerprint.set(fingerprint, exactHandle);
    blogSourceByFingerprint.set(fingerprint, blog);
    categories.push({
      sourceFingerprint: fingerprint,
      record: {
        name,
        slug,
        description: null,
        created_at: unixTimestamp(blog.created_at) ?? UNKNOWN_SOURCE_UNIX_TIMESTAMP,
        updated_at: unixTimestamp(blog.updated_at) ?? UNKNOWN_SOURCE_UNIX_TIMESTAMP,
      },
      conflict: { strategy: "insert-only", key: "slug", onConflict: "reuse" },
    });
  }

  const categorySlugCounts = new Map<string, number>();
  for (const category of categories) {
    categorySlugCounts.set(category.record.slug, (categorySlugCounts.get(category.record.slug) ?? 0) + 1);
  }
  const acceptedCategories = categories.flatMap((category) => {
    if (categorySlugCounts.get(category.record.slug) === 1) return [category];
    skipped.push({
      record: blogSourceByFingerprint.get(category.sourceFingerprint)!,
      reason: `Ambiguous duplicate blog category slug: ${category.record.slug}`,
    });
    return [];
  });
  for (const category of acceptedCategories) {
    const handle = blogHandleByFingerprint.get(category.sourceFingerprint)!;
    categoryIdMap.set(category.sourceFingerprint, category.record.slug);
    blogByFingerprint.set(category.sourceFingerprint, { slug: category.record.slug, handle });
  }

  const canonicalArticles = canonicalProviderRecords(articles, "article", (article) => article.id);
  for (const article of canonicalArticles.records) {
    const sourceId = String(article.id ?? "").trim();
    const sourceFingerprint = sourceId && sourceId.length <= 256
      ? providerFingerprint(SHOPIFY_PROVIDER, "article", sourceId)
      : "";
    const blogSourceId = String(article.blog_id ?? "").trim();
    const blogFingerprint = blogSourceId && blogSourceId.length <= 256
      ? providerFingerprint(SHOPIFY_PROVIDER, "blog", blogSourceId)
      : "";
    const category = blogByFingerprint.get(blogFingerprint);
    const title = article.title?.trim();
    const slug = normalizeSlug(article.handle ?? "");
    const exactHandle = article.handle?.trim();
    const author = article.author?.trim() || fallbackAuthor;
    if (sourceFingerprint && canonicalArticles.duplicateFingerprints.has(sourceFingerprint)) {
      skipped.push({ record: article, reason: "Duplicate article source identity" });
      continue;
    }
    if (
      !sourceFingerprint || sourceId.length > 256 || !category || !title || title.length > 200 || !slug || slug.length > 160 || !author ||
      author.length > 160 || (article.body_html?.length ?? 0) > 100_000 ||
      (article.summary_html?.length ?? 0) > 10_000 || (article.tags?.length ?? 0) > 4_000 ||
      exactHandle !== slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exactHandle)
    ) {
      skipped.push({
        record: article,
        reason: !category
          ? "Article references a blog that was not imported"
          : "Article requires an id, title, author, and valid handle",
      });
      continue;
    }
    const ownerId = deterministicProviderId(SHOPIFY_PROVIDER, "article", sourceId);
    const body = rewriteAndSanitizeHtml(article.body_html ?? "", allowedMediaHosts, ownerId, "blog-inline");
    if (body.html.length > 100_000 || !fitsEscapedSqlText(body.html)) {
      skipped.push({ record: article, reason: "Article content exceeds the SQL-safe text limit" });
      continue;
    }
    const cover = article.image?.src
      ? mediaRewrite(article.image.src, allowedMediaHosts, ownerId, "blog-cover", 1, {
        altText: (article.image.alt?.trim() || title).slice(0, 300),
        width: boundedPositiveInteger(article.image.width),
        height: boundedPositiveInteger(article.image.height),
      })
      : null;
    if (article.image?.src && !cover) {
      warnings.push(`Article ${sourceFingerprint} has an invalid or unsupported cover image; image omitted`);
    }
    const publishedAt = unixTimestamp(article.published_at);
    if (article.published_at && publishedAt === null) {
      warnings.push(`Article ${sourceFingerprint} has an invalid publication time and was imported as draft`);
    }
    const requestedPublished = article.published !== false && publishedAt !== null;
    const status = requestedPublished && body.html.trim() ? "published" : "draft";
    if (requestedPublished && !body.html.trim()) {
      warnings.push(`Article ${sourceFingerprint} has no safe content and was imported as draft`);
    }
    const summary = article.summary_html ? excerptFromHtml(article.summary_html) : excerptFromHtml(body.html);
    let tags: string[];
    try {
      tags = normalizeBlogTags((article.tags ?? "").split(",").filter((tag) => tag.trim()));
    } catch {
      skipped.push({ record: article, reason: "Article tags exceed the current blog limits" });
      continue;
    }

    articleSourceByFingerprint.set(sourceFingerprint, article);
    records.push({
      sourceFingerprint,
      categoryReference: {
        provider: SHOPIFY_PROVIDER,
        sourceFingerprint: blogFingerprint,
        slug: category.slug,
      },
      record: {
        title,
        slug,
        author,
        excerpt: summary,
        tags: JSON.stringify(tags),
        cover_image_url: cover?.publicPath ?? null,
        cover_image_alt: cover?.altText ?? null,
        status,
        editor_json: null,
        html: body.html,
        reading_time: calculateBlogReadingTime(body.html),
        meta_title: title,
        meta_description: summary,
        published_at: status === "published" ? publishedAt : null,
        created_at: unixTimestamp(article.created_at) ?? UNKNOWN_SOURCE_UNIX_TIMESTAMP,
        updated_at: unixTimestamp(article.updated_at) ?? UNKNOWN_SOURCE_UNIX_TIMESTAMP,
        created_by: actorId,
        updated_by: actorId,
      },
      media: [...(cover ? [cover] : []), ...body.media],
      redirect: {
        sourcePath: `/blogs/${category.handle}/${slug}`,
        targetPath: `/blog/${slug}`,
        statusCode: 301,
        entityType: "blog",
      },
      conflict: { strategy: "insert-only", key: "slug", onConflict: "skip" },
    });
  }
  const postSlugCounts = new Map<string, number>();
  for (const post of records) postSlugCounts.set(post.record.slug, (postSlugCounts.get(post.record.slug) ?? 0) + 1);
  const acceptedRecords = records.flatMap((record) => {
    if (postSlugCounts.get(record.record.slug) === 1) return [record];
    skipped.push({
      record: articleSourceByFingerprint.get(record.sourceFingerprint)!,
      reason: `Ambiguous duplicate blog post slug: ${record.record.slug}`,
    });
    return [];
  });
  for (const record of acceptedRecords) idMap.set(record.sourceFingerprint, record.record.slug);
  return { categories: acceptedCategories, records: acceptedRecords, idMap, categoryIdMap, skipped, warnings };
}
