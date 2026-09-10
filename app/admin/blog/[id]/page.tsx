import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/auth/admin-session";
import BlogEditor from "@/components/admin/blog/BlogEditor";

export const metadata: Metadata = { title: "Edit blog post | Admin" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  return <BlogEditor postId={(await params).id} />;
}
