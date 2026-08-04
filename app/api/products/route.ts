/**
 * Products API - MACH-compliant product management
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  listProducts, 
  createProduct, 
  getProductsByCategory
} from "@/lib/models/mach/products";
import type { ApiResponse, Product } from "@/lib/types";
import {
  toPublicProduct,
  toWireProduct,
  type WireProduct,
} from "@/lib/models/mach/product-serializer";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { errorDetails } from "@/lib/utils/error-response";

const PRODUCT_STATUSES = ['active', 'inactive', 'draft', 'archived'] as const;
type ProductStatus = (typeof PRODUCT_STATUSES)[number];

function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value);
}

const PRODUCT_CREATE_VALIDATION_MESSAGES = new Set([
  'Invalid product data provided',
]);

function productCreateValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return PRODUCT_CREATE_VALIDATION_MESSAGES.has(error.message) ? error.message : undefined;
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : fallback, min), max);
}

/**
 * GET /api/products - List products
 */
export async function GET(request: NextRequest) {
  try {
    // GET remains public. Authentication only selects the admin representation;
    // no query parameter can opt an unauthenticated caller into that view.
    const adminAuth = await checkAdminPermissions(request);
    const isAdmin = adminAuth.success;
    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get('limit'), 20, 1, 100);
    const offset = clampInt(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);
    const requestedStatus = url.searchParams.get('status');
    const category = url.searchParams.get('category');

    if (isAdmin && requestedStatus && !isProductStatus(requestedStatus)) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: [`Invalid status: ${requestedStatus}`],
        },
        { status: 400 }
      );
    }

    const statusFilter: ProductStatus[] | undefined = isAdmin
      ? (requestedStatus ? [requestedStatus as ProductStatus] : undefined)
      : ['active'];
    const filterByStatus = (products: Product[]): Product[] =>
      statusFilter
        ? products.filter((product) => statusFilter.includes(product.status as ProductStatus))
        : products;

    let total: number;
    let products: Product[];

    if (category?.trim()) {
      // The category model is not status/pagination aware. Filter before
      // slicing so totals and links describe the same public result set.
      const visibleProducts = filterByStatus(await getProductsByCategory(category.trim()));
      total = visibleProducts.length;
      products = visibleProducts.slice(offset, offset + limit);
    } else {
      const [allProducts, page] = await Promise.all([
        listProducts({ status: statusFilter }),
        listProducts({ status: statusFilter, limit, offset }),
      ]);
      total = filterByStatus(allProducts).length;
      products = filterByStatus(page);
    }

    const responseProducts = (isAdmin
      ? products
      : products.map(toPublicProduct)
    ).map(toWireProduct);

    const response: ApiResponse<WireProduct[]> = {
      data: responseProducts,
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
  const adminAuth = await checkAdminPermissions(request);
  if (!adminAuth.success) {
    return NextResponse.json({ error: adminAuth.error }, { status: 401 });
  }

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
    const response: ApiResponse<WireProduct> = {
      data: toWireProduct(product),
      meta: {
        schema: "mach:product"
      }
    };
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Products API error:', error);
    const validationMessage = productCreateValidationMessage(error);
    if (validationMessage) {
      return NextResponse.json({
        error: 'Validation failed',
        message: validationMessage
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create product', ...errorDetails(error) },
      { status: 500 }
    );
  }
}
