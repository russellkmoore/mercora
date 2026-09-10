import type { MetadataRoute } from "next";
import { getStoreConfig } from "@/lib/store-config";
import { getSitemapCatalogEntries } from "@/lib/seo/sitemap-data";
import { getPublishedPages } from "@/lib/models/pages";
import { getPublishedBlogSitemapEntries } from "@/lib/models/blog";
import { parseCmsTimestamp } from "@/lib/utils/cms-timestamp";
import { isPubliclyVisibleProduct } from "@/lib/gift-cards/visibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const store = getStoreConfig();
  const url = (path: string) => new URL(path, `${store.urls.site}/`).href;
  const core: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/blog"), changeFrequency: "weekly", priority: 0.7 },
  ];
  const [catalogResult, pagesResult, postsResult] = await Promise.allSettled([
    getSitemapCatalogEntries(),
    getPublishedPages(),
    getPublishedBlogSitemapEntries(),
  ]);
  const catalog = catalogResult.status === "fulfilled"
    ? catalogResult.value
    : { products: [], categories: [] };
  const pages = pagesResult.status === "fulfilled" ? pagesResult.value : [];
  const posts = postsResult.status === "fulfilled" ? postsResult.value : [];
  // A sitemap is an index, so it gets the same predicate as every other
  // listing surface (D-07, D-14): the gift card drops out whenever selling is
  // off. That covers the case that actually hurts — with both flags off the
  // product page calls notFound() (D-10), and an authoritative index handing
  // crawlers a 404 is worse than a missing entry. Under sell=off/honor=on the
  // page still renders for anyone holding the link; it just is not advertised,
  // exactly as it is not advertised on the home page or in search.
  const visibleProducts = catalog.products.filter(
    (item) => isPubliclyVisibleProduct(item, store.commerce.features),
  );
  const entries = [
    ...core,
    ...visibleProducts.map((item) => ({ url: url(`/product/${item.slug}`), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...catalog.categories.map((item) => ({ url: url(`/category/${item.slug}`), lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...pages.map((page) => ({ url: url(`/${page.slug}`), lastModified: parseCmsTimestamp(page.updated_at) ?? undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...posts.map((post) => ({ url: url(`/blog/${post.slug}`), lastModified: parseCmsTimestamp(post.updatedAt) ?? undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()].slice(0, 50_000);
}
