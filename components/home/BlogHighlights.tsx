/**
 * === Blog Highlights (home page) ===
 *
 * The "latest articles" block that can render on the storefront home page
 * (Phase 16, BLOG-02/BLOG-03). Card markup is deliberately the same shape as
 * `components/blog/BlogIndex.tsx`'s cards — there is no new visual design
 * here, only a copy of an already-token-correct card with the title demoted
 * to an `h3` so it nests correctly under this block's own `h2`.
 *
 * This component owns none of the settings read, the enabled/disabled
 * decision, or the empty-state decision — `app/page.tsx` resolves all of
 * that and only calls this component when there is at least one post to
 * show. It is a plain synchronous server component: no client directive,
 * no `async`, no data fetching, no hooks.
 */

import Image from "next/image";
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog/values";
import { resolveBlogExcerpt } from "@/lib/blog/excerpt";
import { formatCmsTimestamp } from "@/lib/utils/cms-timestamp";

export default function BlogHighlights({
  heading,
  posts,
}: {
  heading: string;
  posts: BlogPostSummary[];
}) {
  return (
    <section aria-labelledby="blog-highlights-heading" className="max-w-6xl mx-auto mb-12 sm:mb-16">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 id="blog-highlights-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          {heading}
        </h2>
        <Link href="/blog" className="text-sm font-medium text-primary hover:text-primary/90">
          Read all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
        {posts.map((post) => {
          const excerpt = resolveBlogExcerpt(post);
          return (
            <article key={post.id} className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
              {post.coverImageUrl && (
                <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden>
                  <Image src={post.coverImageUrl} alt="" width={720} height={405} className="aspect-video w-full object-cover" />
                </Link>
              )}
              <div className="p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{formatCmsTimestamp(post.publishedAt)} · {post.readingTime} min read</p>
                <h3 className="mt-2 text-xl font-semibold text-foreground"><Link href={`/blog/${post.slug}`} className="hover:text-primary/90">{post.title}</Link></h3>
                {excerpt !== "" && <p className="mt-3 line-clamp-3 text-muted-foreground">{excerpt}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
