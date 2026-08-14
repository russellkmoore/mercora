/**
 * Admin Pages API - Content Management System
 * 
 * Handles CRUD operations for pages in the admin interface.
 * Protected by admin authentication middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import { customJsChanged, isNonEmptyScript, logCustomJsAudit } from "@/lib/cms/custom-js-guard";
import { errorDetails } from "@/lib/utils/error-response";
import {
  getPages,
  createPage,
  getPageStats,
  searchPages,
  PAGE_STATUS
} from "@/lib/models/pages";

const PAGE_CREATE_VALIDATION_MESSAGES = new Set([
  "Title is required",
  "Content is required",
  "Content is required after sanitization",
]);

function pageCreateValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (PAGE_CREATE_VALIDATION_MESSAGES.has(error.message)) return error.message;
  return error.message.startsWith("Invalid page data:") ? error.message : undefined;
}

/**
 * GET /api/admin/pages - Get all pages with admin access
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const statsOnly = searchParams.get('stats') === 'true';

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getPageStats();
      return NextResponse.json({
        success: true,
        data: stats
      });
    }

    // Handle search
    if (search) {
      const results = await searchPages(search, {
        includeUnpublished: true,
        limit: limit ? parseInt(limit) : undefined
      });
      return NextResponse.json({
        success: true,
        data: results
      });
    }

    // Get pages with filters
    const options: any = {
      includeProtected: true, // Admin can see protected pages
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };

    if (status && Object.values(PAGE_STATUS).includes(status as any)) {
      options.status = status;
    }

    const pages = await getPages(options);

    return NextResponse.json({
      success: true,
      data: pages
    });

  } catch (error) {
    console.error("Error fetching pages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pages - Create a new page
 */
export async function POST(request: NextRequest) {
  // Check admin permissions
  const authResult = await checkAdminPermissions(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const data = await request.json() as Record<string, any>;

    const customJsWrite = customJsChanged(data, null);
    if (customJsWrite && isNonEmptyScript(data.custom_js)) {
      const allowed = await isSuperAdminActor(authResult);
      if (!allowed) {
        logCustomJsAudit({
          actorUserId: authResult.userId,
          action: "create",
          allowed: false,
        });
        return NextResponse.json(
          { success: false, error: "Only a database super-admin may set custom JavaScript." },
          { status: 403 },
        );
      }
    }

    // Add creator information
    const pageData = {
      ...data,
      created_by: authResult.userId,
      updated_by: authResult.userId
    };

    const newPage = await createPage(pageData as any);

    if (customJsWrite) {
      logCustomJsAudit({
        actorUserId: authResult.userId,
        pageId: newPage.id,
        action: "create",
        allowed: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: newPage,
      message: "Page created successfully"
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating page:", error);
    const validationMessage = pageCreateValidationMessage(error);
    if (validationMessage) {
      return NextResponse.json(
        { success: false, error: validationMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create page", ...errorDetails(error) },
      { status: 500 }
    );
  }
}
