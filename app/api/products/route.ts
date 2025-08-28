/**
 * Products API - MACH-compliant product management
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  listProducts, 
  createProduct, 
  updateProduct,
  getProductsByCategory
} from "@/lib/models/mach/products";
import type { ApiResponse, Product } from "@/lib/types";

/**
 * GET /api/products - List products
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status') as 'active' | 'inactive' | 'draft' | 'archived' | null;
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');

    // Get total count first (without limit/offset)
    const allProducts = category && category.trim()
      ? await getProductsByCategory(category.trim())
      : await listProducts({ 
          status: status ? [status] : undefined
        });
    const total = allProducts.length;
    
    // Then get the paginated results
    const products = category && category.trim()
      ? await getProductsByCategory(category.trim())
      : await listProducts({ 
          status: status ? [status] : undefined,
          limit, 
          offset 
        });
    const response: ApiResponse<Product[]> = {
      data: products,
      meta: {
        total,
        limit,
        offset,
        schema: "mach:product"
      },
      links: {
        self: `/api/products?limit=${limit}&offset=${offset}`,
        first: `/api/products?limit=${limit}&offset=0`,
        ...(offset + limit < total && {
          next: `/api/products?limit=${limit}&offset=${offset + limit}`
        }),
        ...(offset > 0 && {
          prev: `/api/products?limit=${limit}&offset=${Math.max(0, offset - limit)}`
        }),
        last: `/api/products?limit=${limit}&offset=${Math.floor(total / limit) * limit}`
      }
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products - Create product
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
  const product = await createProduct(body as Product);
    const response: ApiResponse<Product> = {
      data: product,
      meta: {
        schema: "mach:product"
      }
    };
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Products API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: 'Validation failed',
        message: error.message
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
