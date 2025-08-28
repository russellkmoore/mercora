
import { NextRequest, NextResponse } from "next/server";
import { getCategory, updateCategory, deleteCategory } from "@/lib/models/mach/category";
import type { ApiResponse, Category } from "@/lib/types";

/**
 * GET /api/categories/[id] - Get category by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await params;
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }
    
    const category = await getCategory(categoryId);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const response: ApiResponse<Category> = {
      data: category,
      meta: {
        schema: "mach:category"
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Category GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve category" }, { status: 500 });
  }
}

/**
 * PUT /api/categories/[id] - Update category
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await params;
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const body = await request.json() as any;
    
    // Basic validation
    if (body.name !== undefined && !body.name) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['name cannot be empty']
      }, { status: 400 });
    }

    const category = await updateCategory(categoryId, body);
    
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const response: ApiResponse<Category> = {
      data: category,
      meta: {
        schema: "mach:category"
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Category PUT error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: 'Validation failed',
        message: error.message
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id] - Delete category (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await params;
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const success = await deleteCategory(categoryId);
    
    if (!success) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
