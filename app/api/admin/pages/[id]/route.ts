/**
 * Admin Page Detail API - Content Management System
 * 
 * Handles individual page operations (GET, PUT, DELETE) for admin interface.
 * Protected by admin authentication middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  getPageById,
  updatePage,
  deletePage,
  getPageVersions,
  publishPage,
  unpublishPage,
  archivePage
} from "@/lib/models/pages";

/**
 * GET /api/admin/pages/[id] - Get page by ID with admin access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin permissions
  const authResult = await checkAdminPermissions(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid page ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeVersions = searchParams.get('include_versions') === 'true';

    const page = await getPageById(id);
    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 }
      );
    }

    const response: any = {
      success: true,
      data: page
    };

    // Include versions if requested
    if (includeVersions) {
      const versions = await getPageVersions(id);
      response.data = {
        ...page,
        versions
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/pages/[id] - Update page
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin permissions
  const authResult = await checkAdminPermissions(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid page ID" },
        { status: 400 }
      );
    }

    const data = await request.json() as { action?: string; change_summary?: string; [key: string]: any };
    const { action, change_summary, ...updateData } = data;

    // Handle special actions
    if (action) {
      let result;
      switch (action) {
        case 'publish':
          result = await publishPage(id, authResult.userId);
          break;
        case 'unpublish':
          result = await unpublishPage(id, authResult.userId);
          break;
        case 'archive':
          result = await archivePage(id, authResult.userId);
          break;
        default:
          return NextResponse.json(
            { success: false, error: "Invalid action" },
            { status: 400 }
          );
      }

      if (!result) {
        return NextResponse.json(
          { success: false, error: "Page not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: `Page ${action}ed successfully`
      });
    }

    // Regular update
    const updatedPage = await updatePage(
      id, 
      updateData,
      authResult.userId,
      change_summary
    );

    if (!updatedPage) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedPage,
      message: "Page updated successfully"
    });

  } catch (error) {
    console.error("Error updating page:", error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes("Invalid page data")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update page" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/pages/[id] - Delete page
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin permissions
  const authResult = await checkAdminPermissions(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid page ID" },
        { status: 400 }
      );
    }

    // Check if page exists first
    const page = await getPageById(id);
    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 }
      );
    }

    const success = await deletePage(id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to delete page" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Page deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting page:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete page" },
      { status: 500 }
    );
  }
}