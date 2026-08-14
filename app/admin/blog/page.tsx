import type { Metadata } from "next";
import BlogManagement from "@/components/admin/blog/BlogManagement";

export const metadata: Metadata = { title: "Blog | Admin" };

export default function AdminBlogPage() {
  return <BlogManagement />;
}
