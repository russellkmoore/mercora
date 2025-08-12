import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/models/mach/products";
import type { Product } from "@/lib/types";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    const product = await getProduct(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
  return NextResponse.json({ data: product, meta: { schema: "mach:product" } });
  } catch (error) {
    console.error("Product GET error:", error);
    return NextResponse.json({ error: "Failed to retrieve product" }, { status: 500 });
  }
}
