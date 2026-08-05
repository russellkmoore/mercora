import { NextRequest, NextResponse } from "next/server";
import { getProduct, updateProduct, deleteProduct } from "@/lib/models/mach/products";
import type { Product } from "@/lib/types";
import { toPublicProduct, toWireProduct } from "@/lib/models/mach/product-serializer";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { errorDetails } from "@/lib/utils/error-response";

/**
 * GET /api/products/[id] - Get a specific product
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    const product = await getProduct(productId);
    const adminAuth = await checkAdminPermissions(request);
    if (!product || (!adminAuth.success && product.status !== 'active')) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const visibleProduct = adminAuth.success ? product : toPublicProduct(product);
    return NextResponse.json({ data: toWireProduct(visibleProduct), meta: { schema: "mach:product" } });
  } catch (error) {
    console.error("Product GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve product" }, { status: 500 });
  }
}

/**
 * PUT /api/products/[id] - Update a specific product
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await checkAdminPermissions(request);
  if (!adminAuth.success) {
    return NextResponse.json({ error: adminAuth.error }, { status: 401 });
  }

  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const body = await request.json() as Partial<Product>;
    
    // Validate required fields
    if (!body.name && !body.description && !body.status) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['At least one field must be provided for update']
      }, { status: 400 });
    }

    // Ensure the ID in the body matches the URL parameter
    body.id = productId;

    const updatedProduct = await updateProduct(productId, body);
    if (!updatedProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      data: toWireProduct(updatedProduct),
      meta: { schema: "mach:product" } 
    });

  } catch (error) {
    console.error("Product PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update product", ...errorDetails(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id] - Delete a specific product
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await checkAdminPermissions(request);
  if (!adminAuth.success) {
    return NextResponse.json({ error: adminAuth.error }, { status: 401 });
  }

  try {
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const deleted = await deleteProduct(productId);
    if (!deleted) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      message: "Product deleted successfully",
      meta: { schema: "mach:product" }
    });

  } catch (error) {
    console.error("Product DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
