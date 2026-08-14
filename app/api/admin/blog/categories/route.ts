import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { blogErrorStatus, isPlainObject } from "@/lib/blog/http";
import {
  adminCreateBlogCategory,
  getBlogCategories,
  type BlogCategoryInput,
} from "@/lib/models/blog";

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await getBlogCategories() });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ success: false, error: "A category object is required" }, { status: 400 });
    }
    const category = await adminCreateBlogCategory(body as unknown as BlogCategoryInput);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    const status = blogErrorStatus(error);
    return NextResponse.json({
      success: false,
      error: status === 500 ? "Failed to create category"
        : status === 409 ? "A category with this slug already exists"
          : (error as Error).message,
    }, { status });
  }
}
