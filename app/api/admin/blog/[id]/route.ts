import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { adminDeleteBlogPost, adminGetBlogPost, adminUpdateBlogPost, type BlogPostInput } from "@/lib/models/blog";
import { blogErrorStatus, isPlainObject, parseBlogId } from "@/lib/blog/http";

type Context = { params: Promise<{ id: string }> };

async function authorizedId(request: NextRequest, context: Context) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return { ok: false as const, response: NextResponse.json({ success: false, error: auth.error }, { status: 401 }) };
  const id = parseBlogId((await context.params).id);
  if (!id) return { ok: false as const, response: NextResponse.json({ success: false, error: "Invalid post ID" }, { status: 400 }) };
  return { ok: true as const, auth, id };
}

export async function GET(request: NextRequest, context: Context) {
  const gate = await authorizedId(request, context);
  if (!gate.ok) return gate.response;
  try {
    const post = await adminGetBlogPost(gate.id);
    return post
      ? NextResponse.json({ success: true, data: post })
      : NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const gate = await authorizedId(request, context);
  if (!gate.ok) return gate.response;
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ success: false, error: "A post object is required" }, { status: 400 });
    }
    const post = await adminUpdateBlogPost(gate.id, {
      ...(body as Partial<BlogPostInput>),
      updatedBy: gate.auth.userId ?? null,
    });
    return post
      ? NextResponse.json({ success: true, data: post })
      : NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
  } catch (error) {
    const status = blogErrorStatus(error);
    return NextResponse.json({
      success: false,
      error: status === 500
        ? "Failed to update post"
        : status === 409 ? "A post with this slug already exists" : (error as Error).message,
    }, { status });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const gate = await authorizedId(request, context);
  if (!gate.ok) return gate.response;
  try {
    return await adminDeleteBlogPost(gate.id)
      ? NextResponse.json({ success: true })
      : NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete post" }, { status: 500 });
  }
}
