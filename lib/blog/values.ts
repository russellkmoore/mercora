export type BlogPostStatus = "draft" | "published";

export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  author: string;
  excerpt: string | null;
  tags: string[];
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  status: BlogPostStatus;
  readingTime: number;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const MAX_TAGS = 20;

function requiredTag(value: unknown): string {
  if (typeof value !== "string") throw new Error("Tag must be text");
  const tag = value.trim().toLowerCase();
  if (!tag) throw new Error("Tag is required");
  if (tag.length > 50) throw new Error("Tag is too long");
  return tag;
}

export function normalizeBlogSlug(value: string): string {
  const slug = value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 160) throw new Error("Slug must be between 1 and 160 characters");
  return slug;
}

export function normalizeBlogTags(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Tags must be an array");
  return [...new Set(value.map(requiredTag))].slice(0, MAX_TAGS);
}

export function calculateBlogReadingTime(html: string): number {
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.min(1440, Math.ceil(words / 250)));
}

export function getRelatedBlogPosts(
  posts: readonly BlogPostSummary[],
  currentSlug: string,
  currentTags: readonly string[],
  limit = 3,
): BlogPostSummary[] {
  const tags = new Set(currentTags);
  return posts.filter((post) => post.slug !== currentSlug && post.status === "published")
    .map((post) => ({ post, score: post.tags.filter((tag) => tags.has(tag)).length }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || (right.post.publishedAt ?? 0) - (left.post.publishedAt ?? 0))
    .slice(0, Math.max(0, Math.min(12, limit)))
    .map(({ post }) => post);
}
