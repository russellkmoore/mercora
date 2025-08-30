import { NextRequest, NextResponse } from "next/server";
import { updateAllCategoryProductCounts } from "@/lib/models";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";

/**
 * POST /api/admin/categories/refresh-counts - Refresh all category product counts
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authCheck = await checkAdminPermissions(request);
    if (!authCheck.success) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log("Refreshing category product counts...");
    await updateAllCategoryProductCounts();
    console.log("Category product counts refreshed successfully");

    return NextResponse.json({
      message: "Category product counts refreshed successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Category refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh category counts' },
      { status: 500 }
    );
  }
}