import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBlogPost, getPublishedBlogPosts, getRelatedBlogPosts } from "@/lib/models/blog";
import { getStoreConfig } from "@/lib/store-config";
import { sanitizeRichHtmlServer } from "@/lib/utils/sanitize-html-server";
import { formatCmsTimestamp } from "@/lib/utils/cms-timestamp";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) return { title: "Post not found" };
  const store = getStoreConfig();
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || `${post.title} — ${store.identity.name}`;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title, description, type: "article", images: post.coverImageUrl ? [post.coverImageUrl] : [] },
    twitter: { card: post.coverImageUrl ? "summary_large_image" : "summary", title, description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPublishedBlogPost((await params).slug);
  if (!post) notFound();
  const store = getStoreConfig();
  const html = sanitizeRichHtmlServer(post.html, { allowedImageOrigin: store.urls.imageCdn });
  const related = getRelatedBlogPosts(await getPublishedBlogPosts({ limit: 100 }), post.slug, post.tags);
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription || post.excerpt || undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt * 1000).toISOString() : undefined,
    dateModified: new Date(post.updatedAt * 1000).toISOString(),
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: store.identity.name },
    mainEntityOfPage: new URL(`/blog/${post.slug}`, store.urls.site).href,
    image: post.coverImageUrl || undefined,
  }).replace(/</g, "\\u003c");
  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <Link href="/blog" className="text-sm text-orange-400 hover:text-orange-300">← Blog</Link>
      <header className="mt-6">
        <h1 className="text-4xl font-bold text-white sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-neutral-400">By {post.author} · {formatCmsTimestamp(post.publishedAt)} · {post.readingTime} min read</p>
        {post.excerpt && <p className="mt-5 text-xl leading-relaxed text-neutral-300">{post.excerpt}</p>}
      </header>
      {post.coverImageUrl && <Image src={post.coverImageUrl} alt={post.coverImageAlt || ""} width={1200} height={675} className="mt-8 aspect-video w-full rounded-xl object-cover" priority />}
      <div className="prose prose-invert prose-orange mt-10 max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      {related.length > 0 && (
        <aside className="mt-12 border-t border-neutral-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Related posts</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((item) => <Link key={item.id} href={`/blog/${item.slug}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-neutral-200 hover:border-orange-500">{item.title}</Link>)}
          </div>
        </aside>
      )}
    </article>
  );
}
