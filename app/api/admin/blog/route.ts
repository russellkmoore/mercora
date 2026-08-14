import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { adminCreateBlogPost, adminListBlogPosts, getBlogStats, type BlogPostInput } from "@/lib/models/blog";
import { blogErrorStatus, isPlainObject, parseBlogStatus, parseOffset, parsePositiveInt } from "@/lib/blog/http";

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("stats") === "true") {
      return NextResponse.json({ success: true, data: await getBlogStats() });
    }
    const search = params.get("search")?.trim();
    if (search && search.length > 200) {
      return NextResponse.json({ success: false, error: "Search is too long" }, { status: 400 });
    }
    const posts = await adminListBlogPosts({
      status: parseBlogStatus(params.get("status")),
      search,
      limit: parsePositiveInt(params.get("limit"), 50, 100),
      offset: parseOffset(params.get("offset")),
    });
    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    const status = blogErrorStatus(error);
    return NextResponse.json({ success: false, error: status === 400 ? (error as Error).message : "Failed to fetch posts" }, { status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ success: false, error: "A post object is required" }, { status: 400 });
    }
    const input = body as unknown as BlogPostInput;
    const post = await adminCreateBlogPost({
      ...input,
      createdBy: auth.userId ?? null,
      updatedBy: auth.userId ?? null,
    });
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    const status = blogErrorStatus(error);
    return NextResponse.json({
      success: false,
      error: status === 500
        ? "Failed to create post"
        : status === 409 ? "A post with this slug already exists" : (error as Error).message,
    }, { status });
  }
}
