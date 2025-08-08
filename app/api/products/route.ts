/**
 * Products API - MACH-compliant product management
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  listProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  getProductsCount,
  type CreateProductInput 
} from "@/lib/models/mach/products";
import type { MACHApiResponse } from "@/lib/types";

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

    const [products, total] = await Promise.all([
      listProducts({ 
        status: status || undefined,
        search: search || undefined,
        category: category || undefined,
        limit, 
        offset 
      }),
      getProductsCount({ 
        status: status || undefined,
        search: search || undefined,
        category: category || undefined,
      })
    ]);

    const response: MACHApiResponse<typeof products> = {
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

    if (!body.pricing?.basePrice || !body.pricing?.currency) {
      return NextResponse.json({
        error: 'Validation failed',
        details: [
          'pricing.basePrice is required',
          'pricing.currency is required'
        ]
      }, { status: 400 });
    }

    const product = await createProduct(body as CreateProductInput);
    
    const response: MACHApiResponse<typeof product> = {
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
