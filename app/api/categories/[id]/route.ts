
import { NextRequest, NextResponse } from "next/server";
import { getCategory } from "@/lib/models/";
import type { Category } from "@/lib/types";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const categoryId = params.id;
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }
    const category = await getCategory(categoryId);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({ data: category, meta: { schema: "mach:category" } });
  } catch (error) {
    console.error("Category GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve category" }, { status: 500 });
  }
}
