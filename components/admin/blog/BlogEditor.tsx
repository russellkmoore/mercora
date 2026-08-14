"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { normalizeBlogSlug } from "@/lib/blog/values";
import { sanitizeRichHtml } from "@/lib/utils/sanitize-html";
import type { BlogPost, BlogPostStatus } from "@/lib/models/blog";

type FormState = {
  title: string;
  slug: string;
  author: string;
  excerpt: string;
  tags: string;
  coverImageUrl: string;
  coverImageAlt: string;
  status: BlogPostStatus;
  html: string;
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
};

const emptyForm: FormState = {
  title: "", slug: "", author: "", excerpt: "", tags: "", coverImageUrl: "",
  coverImageAlt: "", status: "draft", html: "", metaTitle: "", metaDescription: "", publishedAt: "",
};

function localDateTime(timestamp: number | null): string {
  if (timestamp === null) return "";
  const date = new Date(timestamp * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function BlogEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => sanitizeRichHtml(form.html), [form.html]);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!postId) return;
    const controller = new AbortController();
    void fetch(`/api/admin/blog/${postId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { data?: BlogPost; error?: string };
        if (!response.ok || !body.data) throw new Error(body.error || "Unable to load post");
        const post = body.data;
        setForm({
          title: post.title, slug: post.slug, author: post.author, excerpt: post.excerpt ?? "",
          tags: post.tags.join(", "), coverImageUrl: post.coverImageUrl ?? "",
          coverImageAlt: post.coverImageAlt ?? "", status: post.status, html: post.html,
          metaTitle: post.metaTitle ?? "", metaDescription: post.metaDescription ?? "",
          publishedAt: localDateTime(post.publishedAt),
        });
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") toast.error(error.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [postId]);

  const upload = async (file: File) => {
    const data = new FormData();
    data.set("file", file);
    data.set("folder", "blog");
    let filename = "post-image";
    try {
      filename = normalizeBlogSlug(form.slug || form.title || filename);
    } catch {
      // The upload route still receives a safe filename when the draft fields
      // cannot yet produce a valid post slug.
    }
    data.set("filename", filename);
    const response = await fetch("/api/admin/upload-image", { method: "POST", body: data });
    const body = await response.json() as { path?: string; error?: string };
    if (!response.ok || !body.path) throw new Error(body.error || "Upload failed");
    update("coverImageUrl", body.path);
  };

  const save = async (status: BlogPostStatus) => {
    setSaving(true);
    try {
      const publishedAt = form.publishedAt
        ? Math.floor(new Date(form.publishedAt).getTime() / 1000)
        : undefined;
      const payload = {
        title: form.title,
        ...(form.slug && { slug: form.slug }),
        ...(form.author && { author: form.author }),
        excerpt: form.excerpt || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        coverImageUrl: form.coverImageUrl || null,
        coverImageAlt: form.coverImageAlt || null,
        status,
        html: form.html,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        ...(publishedAt !== undefined && { publishedAt }),
      };
      const response = await fetch(postId ? `/api/admin/blog/${postId}` : "/api/admin/blog", {
        method: postId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { data?: BlogPost; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Unable to save post");
      setForm((current) => ({ ...current, status: body.data!.status, slug: body.data!.slug }));
      toast.success(status === "published" ? "Post published" : "Draft saved");
      if (!postId) router.replace(`/admin/blog/${body.data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save post");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-400">Loading post…</p>;

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/blog" className="text-sm text-orange-400 hover:text-orange-300">← Back to Blog</Link>
          <h1 className="mt-2 text-3xl font-bold text-white">{postId ? "Edit post" : "New post"}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => void save("draft")} className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-neutral-200 disabled:opacity-50">
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button type="button" disabled={saving} onClick={() => void save("published")} className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50">Publish</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <Field label="Title"><input required value={form.title} onChange={(event) => update("title", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug"><input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="generated-from-title" className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
            <Field label="Author"><input value={form.author} onChange={(event) => update("author", event.target.value)} placeholder="Uses configured store name" className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          </div>
          <Field label="Excerpt"><textarea value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} rows={3} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <Field label="Post HTML" hint="HTML is sanitized again on the server before storage.">
            <textarea value={form.html} onChange={(event) => update("html", event.target.value)} rows={18} spellCheck={false} className="admin-input w-full rounded-lg border px-3 py-2 font-mono text-sm" />
          </Field>
          <div>
            <h2 className="mb-2 text-sm font-medium text-neutral-200">Sanitized preview</h2>
            <div className="prose prose-invert prose-orange min-h-24 max-w-none rounded-lg border border-neutral-700 bg-neutral-950 p-5" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>

        <aside className="space-y-5 rounded-xl border border-neutral-700 bg-neutral-900 p-6 self-start">
          <Field label="Tags" hint="Comma-separated"><input value={form.tags} onChange={(event) => update("tags", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <Field label="Publish at"><input type="datetime-local" value={form.publishedAt} onChange={(event) => update("publishedAt", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <Field label="Cover image path"><input value={form.coverImageUrl} onChange={(event) => update("coverImageUrl", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-600 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800">
            <ImagePlus className="h-4 w-4" /> Upload cover image
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file).catch((error) => toast.error(error instanceof Error ? error.message : "Upload failed"));
            }} />
          </label>
          <Field label="Cover image alt text"><input value={form.coverImageAlt} onChange={(event) => update("coverImageAlt", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <Field label="SEO title"><input value={form.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <Field label="SEO description"><textarea value={form.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} rows={4} className="admin-input w-full rounded-lg border px-3 py-2" /></Field>
          <p className="text-xs text-neutral-500">Current status: {form.status}</p>
        </aside>
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-neutral-200">
      {label}
      {hint && <span className="ml-2 font-normal text-neutral-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
