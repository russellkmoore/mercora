import { NextRequest, NextResponse } from "next/server";
import { getPublishedBlogPosts } from "@/lib/models/blog";
import { parseOffset, parsePositiveInt } from "@/lib/blog/http";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const posts = await getPublishedBlogPosts({
      limit: parsePositiveInt(params.get("limit"), 24, 100),
      offset: parseOffset(params.get("offset")),
    });
    return NextResponse.json({ success: true, data: posts });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch posts" }, { status: 500 });
  }
}
