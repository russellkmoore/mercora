import { NextResponse } from "next/server";
import { getPublishedBlogPost } from "@/lib/models/blog";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const post = await getPublishedBlogPost((await params).slug);
    return post
      ? NextResponse.json({ success: true, data: post })
      : NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("slug")) {
      return NextResponse.json({ success: false, error: "Invalid post slug" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to fetch post" }, { status: 500 });
  }
}
