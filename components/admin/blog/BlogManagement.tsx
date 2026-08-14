"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePlus2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BlogPostSummary, BlogPostStatus } from "@/lib/blog/values";
import { formatCmsTimestamp } from "@/lib/utils/cms-timestamp";

export default function BlogManagement() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [status, setStatus] = useState<BlogPostStatus | "">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const query = status ? `?status=${status}` : "";
    void fetch(`/api/admin/blog${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { success: boolean; data?: BlogPostSummary[]; error?: string };
        if (!response.ok || !body.success) throw new Error(body.error || "Unable to load posts");
        setPosts(body.data ?? []);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") toast.error(error.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [status]);

  const remove = async (post: BlogPostSummary) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to delete post");
      return;
    }
    toast.success("Post deleted");
    setPosts((current) => current.filter(({ id }) => id !== post.id));
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Blog</h1>
          <p className="mt-1 text-neutral-400">Create and publish editorial content.</p>
        </div>
        <Link href="/admin/blog/new" className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">
          <FilePlus2 className="h-4 w-4" /> New post
        </Link>
      </div>

      <label className="mb-4 block max-w-xs text-sm text-neutral-300">
        Status
        <select value={status} onChange={(event) => {
          setLoading(true);
          setStatus(event.target.value as BlogPostStatus | "");
        }} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white">
          <option value="">All posts</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      <div className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900">
        {loading ? (
          <p className="p-6 text-neutral-400">Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="p-6 text-neutral-400">No posts yet.</p>
        ) : (
          <div className="divide-y divide-neutral-700">
            {posts.map((post) => (
              <article key={post.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-white">{post.title}</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {post.status} · {formatCmsTimestamp(post.publishedAt ?? post.updatedAt) || "Unscheduled"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/blog/${post.id}`} aria-label={`Edit ${post.title}`} className="rounded-md border border-neutral-600 p-2 text-neutral-300 hover:text-white">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button type="button" onClick={() => void remove(post)} aria-label={`Delete ${post.title}`} className="rounded-md border border-red-900 p-2 text-red-400 hover:bg-red-950">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
