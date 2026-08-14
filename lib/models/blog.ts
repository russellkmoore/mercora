import { cache } from "react";
import { and, desc, eq, like, lte, or, sql, type SQL } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import {
  blogCategories,
  blogPosts,
  type BlogCategoryRow,
  type BlogPostRow,
} from "@/lib/db/schema/blog";
import { getStoreConfig } from "@/lib/store-config";
import { sanitizeRichHtmlServer } from "@/lib/utils/sanitize-html-server";
import { isAllowedImageSource } from "@/lib/utils/sanitize-html-policy";
import {
  calculateBlogReadingTime,
  getRelatedBlogPosts,
  normalizeBlogSlug,
  normalizeBlogTags,
  type BlogPostStatus,
  type BlogPostSummary,
} from "@/lib/blog/values";

export {
  calculateBlogReadingTime,
  getRelatedBlogPosts,
  normalizeBlogSlug,
  normalizeBlogTags,
};
export type { BlogPostStatus, BlogPostSummary };

export interface BlogPost extends BlogPostSummary {
  editorJson: string | null;
  html: string;
  categoryId: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export type PublicBlogPost = Omit<BlogPost, "editorJson" | "createdBy" | "updatedBy">;

export interface BlogPostInput {
  title: string;
  slug?: string;
  author?: string;
  excerpt?: string | null;
  tags?: unknown;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  status?: BlogPostStatus;
  editorJson?: string | null;
  html?: string;
  categoryId?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  publishedAt?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

const MAX_LIMIT = 100;

type BlogSummaryRow = Pick<BlogPostRow,
  | "id" | "title" | "slug" | "author" | "excerpt" | "tags"
  | "coverImageUrl" | "coverImageAlt" | "status" | "readingTime"
  | "publishedAt" | "createdAt" | "updatedAt"
>;

function optionalText(value: unknown, field: string, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${field} is too long`);
  return normalized || null;
}

function requiredText(value: unknown, field: string, maximum: number): string {
  const normalized = optionalText(value, field, maximum);
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseStoredTags(value: string): string[] {
  try {
    return normalizeBlogTags(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeEditorJson(value: string | null | undefined): string | null {
  if (!value) return null;
  if (new TextEncoder().encode(value).byteLength > 1_048_576) {
    throw new Error("Editor content is too large");
  }
  try {
    JSON.parse(value);
  } catch {
    throw new Error("Editor content must be valid JSON");
  }
  return value;
}

function normalizePublishedAt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Published time must be a non-negative Unix timestamp");
  }
  return value;
}

function normalizeCategoryId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Category must be a positive integer");
  }
  return value;
}

function toSummary(row: BlogSummaryRow): BlogPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    author: row.author,
    excerpt: row.excerpt,
    tags: parseStoredTags(row.tags),
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    status: row.status,
    readingTime: row.readingTime,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPost(row: BlogPostRow): BlogPost {
  return {
    ...toSummary(row),
    editorJson: row.editorJson,
    html: row.html,
    categoryId: row.categoryId,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

function toPublicPost(row: BlogPostRow): PublicBlogPost {
  const { editorJson: _editorJson, createdBy: _createdBy, updatedBy: _updatedBy, ...post } = toPost(row);
  return post;
}

function sanitizeBody(html: string): string {
  const config = getStoreConfig();
  return sanitizeRichHtmlServer(html, { allowedImageOrigin: config.urls.imageCdn });
}

function normalizedCoverImage(value: string | null | undefined): string | null {
  const image = optionalText(value, "Cover image URL", 2048);
  if (!image) return null;
  if (!isAllowedImageSource(image, getStoreConfig().urls.imageCdn)) {
    throw new Error("Cover image URL is not allowed");
  }
  return image;
}

function summaryColumns() {
  return {
    id: blogPosts.id,
    title: blogPosts.title,
    slug: blogPosts.slug,
    author: blogPosts.author,
    excerpt: blogPosts.excerpt,
    tags: blogPosts.tags,
    coverImageUrl: blogPosts.coverImageUrl,
    coverImageAlt: blogPosts.coverImageAlt,
    status: blogPosts.status,
    readingTime: blogPosts.readingTime,
    publishedAt: blogPosts.publishedAt,
    createdAt: blogPosts.createdAt,
    updatedAt: blogPosts.updatedAt,
  };
}

export async function getPublishedBlogPosts(options: {
  now?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<BlogPostSummary[]> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const limit = Math.max(1, Math.min(MAX_LIMIT, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const db = await getDbAsync();
  const rows = await db.select(summaryColumns()).from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, now)))
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
    .limit(limit).offset(offset);
  return rows.map(toSummary);
}

export const getPublishedBlogPost = cache(async (
  slug: string,
  now = Math.floor(Date.now() / 1000),
): Promise<PublicBlogPost | null> => {
  const db = await getDbAsync();
  const rows = await db.select().from(blogPosts)
    .where(and(
      eq(blogPosts.slug, normalizeBlogSlug(slug)),
      eq(blogPosts.status, "published"),
      lte(blogPosts.publishedAt, now),
    )).limit(1);
  return rows[0] ? toPublicPost(rows[0]) : null;
});

export async function adminListBlogPosts(options: {
  status?: BlogPostStatus;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<BlogPostSummary[]> {
  const conditions: SQL[] = [];
  if (options.status) conditions.push(eq(blogPosts.status, options.status));
  const search = optionalText(options.search, "Search", 200);
  if (search) conditions.push(or(like(blogPosts.title, `%${search}%`), like(blogPosts.excerpt, `%${search}%`))!);
  const db = await getDbAsync();
  let query = db.select(summaryColumns()).from(blogPosts).$dynamic();
  if (conditions.length) query = query.where(and(...conditions));
  query = query.orderBy(desc(blogPosts.updatedAt), desc(blogPosts.id))
    .limit(Math.max(1, Math.min(MAX_LIMIT, options.limit ?? 50)))
    .offset(Math.max(0, options.offset ?? 0));
  return (await query).map(toSummary);
}

export async function adminGetBlogPost(id: number): Promise<BlogPost | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = await getDbAsync();
  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return rows[0] ? toPost(rows[0]) : null;
}

function normalizeCreateInput(input: BlogPostInput, now: number) {
  const title = requiredText(input.title, "Title", 200);
  const status = input.status ?? "draft";
  if (status !== "draft" && status !== "published") throw new Error("Status is invalid");
  const html = sanitizeBody(input.html ?? "");
  if (status === "published" && !html.trim()) throw new Error("Published posts require content");
  const config = getStoreConfig();
  return {
    title,
    slug: normalizeBlogSlug(input.slug || title),
    author: optionalText(input.author, "Author", 160) ?? `${config.identity.name} team`,
    excerpt: optionalText(input.excerpt, "Excerpt", 1000),
    tags: JSON.stringify(normalizeBlogTags(input.tags)),
    coverImageUrl: normalizedCoverImage(input.coverImageUrl),
    coverImageAlt: optionalText(input.coverImageAlt, "Cover image alt text", 300),
    status,
    editorJson: normalizeEditorJson(input.editorJson),
    html,
    readingTime: calculateBlogReadingTime(html),
    categoryId: normalizeCategoryId(input.categoryId) ?? null,
    metaTitle: optionalText(input.metaTitle, "Meta title", 200),
    metaDescription: optionalText(input.metaDescription, "Meta description", 500),
    publishedAt: normalizePublishedAt(input.publishedAt) ?? (status === "published" ? now : null),
    createdAt: now,
    updatedAt: now,
    createdBy: optionalText(input.createdBy, "Created by", 255),
    updatedBy: optionalText(input.updatedBy, "Updated by", 255),
  };
}

export async function adminCreateBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const now = Math.floor(Date.now() / 1000);
  const db = await getDbAsync();
  const rows = await db.insert(blogPosts).values(normalizeCreateInput(input, now)).returning();
  return toPost(rows[0]);
}

export async function adminUpdateBlogPost(
  id: number,
  input: Partial<BlogPostInput>,
): Promise<BlogPost | null> {
  const existing = await adminGetBlogPost(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  const status = input.status ?? existing.status;
  if (status !== "draft" && status !== "published") throw new Error("Status is invalid");
  const html = input.html === undefined ? undefined : sanitizeBody(input.html);
  const finalHtml = html ?? existing.html;
  if (status === "published" && !finalHtml.trim()) throw new Error("Published posts require content");
  const publishedAtInput = normalizePublishedAt(input.publishedAt);
  const publishedAt = publishedAtInput !== undefined
    ? publishedAtInput
    : status === "published" ? existing.publishedAt ?? now : existing.publishedAt;
  if (status === "published" && publishedAt === null) {
    throw new Error("Published posts require a publication time");
  }
  const db = await getDbAsync();
  const rows = await db.update(blogPosts).set({
    ...(input.title !== undefined && { title: requiredText(input.title, "Title", 200) }),
    ...(input.slug !== undefined && { slug: normalizeBlogSlug(input.slug) }),
    ...(input.author !== undefined && { author: requiredText(input.author, "Author", 160) }),
    ...(input.excerpt !== undefined && { excerpt: optionalText(input.excerpt, "Excerpt", 1000) }),
    ...(input.tags !== undefined && { tags: JSON.stringify(normalizeBlogTags(input.tags)) }),
    ...(input.coverImageUrl !== undefined && { coverImageUrl: normalizedCoverImage(input.coverImageUrl) }),
    ...(input.coverImageAlt !== undefined && { coverImageAlt: optionalText(input.coverImageAlt, "Cover image alt text", 300) }),
    ...(input.status !== undefined && { status }),
    ...(input.editorJson !== undefined && { editorJson: normalizeEditorJson(input.editorJson) }),
    ...(html !== undefined && { html, readingTime: calculateBlogReadingTime(html) }),
    ...(input.categoryId !== undefined && { categoryId: normalizeCategoryId(input.categoryId) }),
    ...(input.metaTitle !== undefined && { metaTitle: optionalText(input.metaTitle, "Meta title", 200) }),
    ...(input.metaDescription !== undefined && { metaDescription: optionalText(input.metaDescription, "Meta description", 500) }),
    publishedAt,
    updatedAt: now,
    ...(input.updatedBy !== undefined && { updatedBy: optionalText(input.updatedBy, "Updated by", 255) }),
  }).where(eq(blogPosts.id, id)).returning();
  return rows[0] ? toPost(rows[0]) : null;
}

export async function adminDeleteBlogPost(id: number): Promise<boolean> {
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const db = await getDbAsync();
  return (await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning({ id: blogPosts.id })).length > 0;
}

export async function getBlogStats(): Promise<{ total: number; published: number; draft: number }> {
  const db = await getDbAsync();
  const rows = await db.select({ status: blogPosts.status, count: sql<number>`count(*)` })
    .from(blogPosts).groupBy(blogPosts.status);
  const stats = { total: 0, published: 0, draft: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    stats.total += count;
    stats[row.status] = count;
  }
  return stats;
}

export async function getBlogCategories(): Promise<BlogCategoryRow[]> {
  const db = await getDbAsync();
  return db.select().from(blogCategories).orderBy(blogCategories.name);
}
