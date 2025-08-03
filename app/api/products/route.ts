/**
 * === Products API Route ===
 * 
 * RESTful API endpoint for retrieving product data from the database.
 * Supports filtering, searching, and pagination for product listings.
 *
 * === Endpoints ===
 * - GET /api/products - Get all active products
 * - Supports query parameters for filtering and search
 *
 * === Query Parameters ===
 * - category: Filter by product category/tag
 * - search: Search product names and descriptions
 * - limit: Limit number of results (default: no limit)
 * - availability: Filter by availability status
 *
 * === Response Format ===
 * ```json
 * [
 *   {
 *     "id": 1,
 *     "name": "Product Name",
 *     "price": 1999,
 *     "availability": "available",
 *     // ... other product fields
 *   }
 * ]
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { hydrateProduct } from "@/lib/models/product";
import type { Product } from "@/lib/types/product";

/**
 * GET /api/products
 * 
 * Retrieve products from the database with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const availability = searchParams.get("availability");
    
    // Get products from database
    const db = await getDbAsync();
    const rawProducts = await db.query.products.findMany({
      where: (products, { eq }) => eq(products.active, true),
    });
    
    // Hydrate all products
    let productList: Product[] = await Promise.all(
      rawProducts.map(product => hydrateProduct(product))
    );
    
    // Apply filters
    if (category) {
      productList = productList.filter((product: Product) => 
        product.tags.some((tag: string) => 
          tag.toLowerCase().includes(category.toLowerCase())
        )
      );
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      productList = productList.filter((product: Product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.shortDescription.toLowerCase().includes(searchLower) ||
        product.longDescription.toLowerCase().includes(searchLower) ||
        product.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }
    
    if (availability) {
      productList = productList.filter((product: Product) => 
        product.availability === availability
      );
    }
    
    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        productList = productList.slice(0, limitNum);
      }
    }
    
    return NextResponse.json(productList);
    
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
