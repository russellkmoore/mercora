import type { Metadata } from "next";
import BlogEditor from "@/components/admin/blog/BlogEditor";

export const metadata: Metadata = { title: "Edit blog post | Admin" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  return <BlogEditor postId={(await params).id} />;
}
