import { calculateBlogReadingTime, normalizeBlogTags } from "../../../lib/blog/values.js";
import type { ShopifyArticle, ShopifyBlog } from "../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  excerptFromHtml,
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
  const generatedAt = unixTimestamp(requiredMigrationTime(options.generatedAt))!;
  const actorId = options.actorId.trim();
  const fallbackAuthor = options.fallbackAuthor.trim();
  if (!actorId) throw new TypeError("actorId is required for blog attribution");
  if (!fallbackAuthor) throw new TypeError("fallbackAuthor is required");

  const categories: BlogCategoryPlan[] = [];
  const records: BlogPostPlan[] = [];
  const idMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();
  const skipped: Array<TransformFailure<ShopifyBlog | ShopifyArticle>> = [];
  const warnings: string[] = [];
  const categorySlugs = new Set<string>();
  const postSlugs = new Set<string>();
  const blogByFingerprint = new Map<string, { slug: string; handle: string }>();

  for (const blog of blogs) {
    const sourceId = String(blog.id ?? "").trim();
    const name = blog.title?.trim();
    const slug = normalizeSlug(blog.handle ?? "");
    const exactHandle = blog.handle?.trim();
    if (
      !sourceId || !name || name.length > 120 || !slug || slug.length > 160 ||
      exactHandle !== slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(exactHandle)
    ) {
      skipped.push({ record: blog, reason: "Blog requires an id, title, and valid handle" });
      continue;
    }
    if (categorySlugs.has(slug)) {
      skipped.push({ record: blog, reason: `Duplicate blog category slug: ${slug}` });
      continue;
    }
    categorySlugs.add(slug);
    const fingerprint = providerFingerprint(SHOPIFY_PROVIDER, "blog", sourceId);
    categoryIdMap.set(fingerprint, slug);
    blogByFingerprint.set(fingerprint, { slug, handle: exactHandle });
    categories.push({
      sourceFingerprint: fingerprint,
      record: {
        name,
        slug,
        description: null,
        created_at: unixTimestamp(blog.created_at) ?? generatedAt,
        updated_at: unixTimestamp(blog.updated_at) ?? generatedAt,
      },
      conflict: { strategy: "insert-only", key: "slug", onConflict: "reuse" },
    });
  }

  for (const article of articles) {
    const sourceId = String(article.id ?? "").trim();
    const sourceFingerprint = sourceId
      ? providerFingerprint(SHOPIFY_PROVIDER, "article", sourceId)
      : "";
    const blogFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "blog", article.blog_id);
    const category = blogByFingerprint.get(blogFingerprint);
    const title = article.title?.trim();
    const slug = normalizeSlug(article.handle ?? "");
    const exactHandle = article.handle?.trim();
    const author = article.author?.trim() || fallbackAuthor;
    if (
      !sourceFingerprint || !category || !title || title.length > 200 || !slug || slug.length > 160 || !author ||
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
    if (postSlugs.has(slug)) {
      skipped.push({ record: article, reason: `Duplicate blog post slug: ${slug}` });
      continue;
    }
    postSlugs.add(slug);

    const ownerId = deterministicProviderId(SHOPIFY_PROVIDER, "article", sourceId);
    const body = rewriteAndSanitizeHtml(article.body_html ?? "", ownerId, "blog-inline");
    const cover = article.image?.src
      ? mediaRewrite(article.image.src, ownerId, "blog-cover", 1, {
        altText: article.image.alt?.trim() || title,
        width: article.image.width,
        height: article.image.height,
      })
      : null;
    if (article.image?.src && !cover) {
      warnings.push(`Article ${sourceFingerprint} has an invalid or unsupported cover image; image omitted`);
    }
    const publishedAt = unixTimestamp(article.published_at);
    if (article.published_at && publishedAt === null) {
      warnings.push(`Article ${sourceFingerprint} has an invalid publication time and was imported as draft`);
    }
    const status = article.published !== false && publishedAt !== null ? "published" : "draft";
    const summary = article.summary_html ? excerptFromHtml(article.summary_html) : excerptFromHtml(body.html);
    const tags = normalizeBlogTags((article.tags ?? "").split(",").filter((tag) => tag.trim()));

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
        created_at: unixTimestamp(article.created_at) ?? generatedAt,
        updated_at: unixTimestamp(article.updated_at) ?? generatedAt,
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
    idMap.set(sourceFingerprint, slug);
  }

  return { categories, records, idMap, categoryIdMap, skipped, warnings };
}
