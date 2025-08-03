/**
 * === User Orders API Endpoint ===
 * 
 * Retrieves order history for a specific user to enable personalized AI interactions.
 * Used by the enhanced user context system for order-based recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrdersByUserId } from "@/lib/models/order";

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get userId from query params and verify it matches authenticated user
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    
    if (requestedUserId !== userId) {
      return NextResponse.json(
        { error: "Access denied - can only access your own orders" },
        { status: 403 }
      );
    }

    // Fetch user's orders
    const orders = await getOrdersByUserId(userId);

    return NextResponse.json(orders);

  } catch (error) {
    console.error("Error fetching user orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
