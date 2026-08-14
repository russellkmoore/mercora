import type { Metadata } from "next";
import BlogIndex from "@/components/blog/BlogIndex";
import { getPublishedBlogPosts } from "@/lib/models/blog";
import { getStoreConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const store = getStoreConfig();
  return {
    title: `Blog | ${store.identity.name}`,
    description: `News and guides from ${store.identity.name}.`,
    alternates: { canonical: "/blog" },
  };
}

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts({ limit: 100 });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-400">Editorial</p>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Blog</h1>
      </header>
      <BlogIndex posts={posts} />
    </div>
  );
}
