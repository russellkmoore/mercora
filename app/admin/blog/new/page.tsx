import type { Metadata } from "next";
import BlogEditor from "@/components/admin/blog/BlogEditor";

export const metadata: Metadata = { title: "New blog post | Admin" };

export default function NewBlogPostPage() {
  return <BlogEditor />;
}
