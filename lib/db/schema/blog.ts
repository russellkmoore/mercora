import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const blogCategories = sqliteTable("blog_categories", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("blog_categories_slug_idx").on(table.slug),
  check("blog_categories_name_check", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
]);

export const blogPosts = sqliteTable("blog_posts", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  author: text("author").notNull(),
  excerpt: text("excerpt"),
  tags: text("tags").notNull().default("[]"),
  coverImageUrl: text("cover_image_url"),
  coverImageAlt: text("cover_image_alt"),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  editorJson: text("editor_json"),
  html: text("html").notNull().default(""),
  readingTime: integer("reading_time").notNull().default(1),
  categoryId: integer("category_id").references(() => blogCategories.id, { onDelete: "set null" }),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => [
  index("blog_posts_slug_idx").on(table.slug),
  index("blog_posts_status_published_idx").on(table.status, table.publishedAt),
  index("blog_posts_category_idx").on(table.categoryId),
  index("blog_posts_updated_idx").on(table.updatedAt),
  check("blog_posts_title_check", sql`length(trim(${table.title})) BETWEEN 1 AND 200`),
  check("blog_posts_reading_time_check", sql`${table.readingTime} BETWEEN 1 AND 1440`),
]);

export type BlogPostRow = typeof blogPosts.$inferSelect;
export type BlogPostInsert = typeof blogPosts.$inferInsert;
export type BlogCategoryRow = typeof blogCategories.$inferSelect;
export type BlogCategoryInsert = typeof blogCategories.$inferInsert;
