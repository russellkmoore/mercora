import type { PageSelect } from "@/lib/db/schema/pages";

export type PublicPage = Pick<PageSelect,
  | "id" | "title" | "slug" | "content" | "excerpt"
  | "meta_title" | "meta_description" | "meta_keywords"
  | "template" | "published_at" | "updated_at" | "nav_title" | "custom_css"
>;

export function toPublicPage(page: PageSelect): PublicPage {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content,
    excerpt: page.excerpt,
    meta_title: page.meta_title,
    meta_description: page.meta_description,
    meta_keywords: page.meta_keywords,
    template: page.template,
    published_at: page.published_at,
    updated_at: page.updated_at,
    nav_title: page.nav_title,
    custom_css: page.custom_css,
  };
}

export type PublicPageSummary = Omit<PublicPage, "content" | "custom_css">;

export function toPublicPageSummary(page: PageSelect): PublicPageSummary {
  const { content: _content, custom_css: _customCss, ...summary } = toPublicPage(page);
  return summary;
}
