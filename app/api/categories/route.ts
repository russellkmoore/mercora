import { NextRequest, NextResponse } from "next/server";
import { listCategories, createCategory, updateCategory } from "@/lib/models";
import type { ApiResponse, Category } from "@/lib/types";

/**
 * GET /api/categories - List categories
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const statusParam = url.searchParams.get('status');
    const allowedStatuses = ['active', 'inactive', 'archived'] as const;
    const status = allowedStatuses.includes(statusParam as any) ? (statusParam as typeof allowedStatuses[number]) : null;
    const search = url.searchParams.get('search');

    const categories = await listCategories({
      status: status ? [status] : undefined,
      limit,
      offset,
      search: search || undefined
    });
    const total = categories.length;
    const response: ApiResponse<Category[]> = {
      data: categories,
      meta: {
        total,
        limit,
        offset,
        schema: "mach:category"
      },
      links: {
        self: `/api/categories?limit=${limit}&offset=${offset}`,
        first: `/api/categories?limit=${limit}&offset=0`,
        ...(offset + limit < total && {
          next: `/api/categories?limit=${limit}&offset=${offset + limit}`
        }),
        ...(offset > 0 && {
          prev: `/api/categories?limit=${limit}&offset=${Math.max(0, offset - limit)}`
        }),
        last: `/api/categories?limit=${limit}&offset=${Math.floor(total / limit) * limit}`
      }
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories - Create category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as any;
    if (!body.name) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['name is required']
      }, { status: 400 });
    }
    // Optionally, add more MACH spec validation here
    const category = await createCategory(body as Category);
    const response: ApiResponse<Category> = {
      data: category,
      meta: {
        schema: "mach:category"
      }
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Categories API error:', error);
    if (error instanceof Error) {
      return NextResponse.json({
        error: 'Validation failed',
        message: error.message
      }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
