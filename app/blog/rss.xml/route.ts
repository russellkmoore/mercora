import { getPublishedBlogPosts } from "@/lib/models/blog";
import { getStoreConfig } from "@/lib/store-config";
import { buildBlogRss } from "@/lib/blog/rss";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStoreConfig();
  try {
    const xml = buildBlogRss({
      siteUrl: store.urls.site,
      storeName: store.identity.name,
      description: `News and guides from ${store.identity.name}.`,
      posts: await getPublishedBlogPosts({ limit: 100 }),
    });
    return new Response(xml, {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Unable to generate feed", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
