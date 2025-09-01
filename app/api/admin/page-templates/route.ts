/**
 * Admin Page Templates API - Content Management System
 * 
 * Handles page template operations for the admin interface.
 * Protected by admin authentication middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getPageTemplates, getPageTemplate } from "@/lib/models/pages";

/**
 * GET /api/admin/page-templates - Get all page templates
 */
export async function GET(request: NextRequest) {
  // Check admin permissions
  const authResult = await checkAdminPermissions(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const templates = await getPageTemplates(!includeInactive);

    return NextResponse.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error("Error fetching page templates:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch page templates" },
      { status: 500 }
    );
  }
}