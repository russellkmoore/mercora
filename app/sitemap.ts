import type { MetadataRoute } from "next";
import { getStoreConfig } from "@/lib/store-config";
import { getSitemapCatalogEntries } from "@/lib/seo/sitemap-data";
import { getPublishedPages } from "@/lib/models/pages";
import { getPublishedBlogSitemapEntries } from "@/lib/models/blog";
import { parseCmsTimestamp } from "@/lib/utils/cms-timestamp";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const store = getStoreConfig();
  const url = (path: string) => new URL(path, `${store.urls.site}/`).href;
  const core: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/blog"), changeFrequency: "weekly", priority: 0.7 },
  ];
  try {
    const [catalog, pages, posts] = await Promise.all([
      getSitemapCatalogEntries(),
      getPublishedPages(),
      getPublishedBlogSitemapEntries(),
    ]);
    const entries = [
      ...core,
      ...catalog.products.map((item) => ({ url: url(`/product/${item.slug}`), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
      ...catalog.categories.map((item) => ({ url: url(`/category/${item.slug}`), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...pages.map((page) => ({ url: url(`/${page.slug}`), lastModified: parseCmsTimestamp(page.updated_at) ?? undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
      ...posts.map((post) => ({ url: url(`/blog/${post.slug}`), lastModified: parseCmsTimestamp(post.updatedAt) ?? undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
    ];
    return [...new Map(entries.map((entry) => [entry.url, entry])).values()].slice(0, 50_000);
  } catch {
    // A transient content-store failure must not break deployment or emit a
    // false empty sitemap. Stable top-level routes remain discoverable.
    return core;
  }
}
