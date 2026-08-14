"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BlogPostSummary } from "@/lib/blog/values";
import { formatCmsTimestamp } from "@/lib/utils/cms-timestamp";

export default function BlogIndex({ posts }: { posts: BlogPostSummary[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))].sort(), [posts]);
  const visible = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;
  return (
    <>
      {tags.length > 0 && (
        <div role="group" aria-label="Filter posts by tag" className="mb-8 flex flex-wrap gap-2">
          <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)} className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 aria-pressed:border-orange-500 aria-pressed:text-orange-400">All</button>
          {tags.map((value) => (
            <button key={value} type="button" aria-pressed={tag === value} onClick={() => setTag(value)} className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 aria-pressed:border-orange-500 aria-pressed:text-orange-400">{value}</button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-neutral-400">No published posts yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
              {post.coverImageUrl && (
                <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden>
                  <Image src={post.coverImageUrl} alt="" width={720} height={405} className="aspect-video w-full object-cover" />
                </Link>
              )}
              <div className="p-5">
                <p className="text-xs uppercase tracking-wider text-neutral-500">{formatCmsTimestamp(post.publishedAt)} · {post.readingTime} min read</p>
                <h2 className="mt-2 text-xl font-semibold text-white"><Link href={`/blog/${post.slug}`} className="hover:text-orange-400">{post.title}</Link></h2>
                {post.excerpt && <p className="mt-3 line-clamp-3 text-neutral-400">{post.excerpt}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
