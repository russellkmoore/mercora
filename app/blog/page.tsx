import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogIndex from "@/components/blog/BlogIndex";
import { getPublishedBlogPosts } from "@/lib/models/blog";
import { getStoreConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const store = getStoreConfig();
  const rawPage = (await searchParams).page;
  const page = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  return {
    title: `${page > 1 ? `Blog — Page ${page}` : "Blog"} | ${store.identity.name}`,
    description: `News and guides from ${store.identity.name}.`,
    alternates: { canonical: page > 1 ? `/blog?page=${page}` : "/blog" },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const rawPage = (await searchParams).page;
  const page = rawPage && /^\d+$/.test(rawPage) ? Math.max(1, Math.min(417, Number(rawPage))) : 1;
  const pageSize = 24;
  const result = await getPublishedBlogPosts({ limit: pageSize + 1, offset: (page - 1) * pageSize });
  const posts = result.slice(0, pageSize);
  if (page > 1 && posts.length === 0) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-400">Editorial</p>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Blog</h1>
      </header>
      <BlogIndex posts={posts} page={page} hasMore={result.length > pageSize} />
    </div>
  );
}
