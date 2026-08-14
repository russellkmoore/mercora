/**
 * Admin Page Detail API - Content Management System
 * 
 * Handles individual page operations (GET, PUT, DELETE) for admin interface.
 * Protected by admin authentication middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import { customJsChanged, isNonEmptyScript, logCustomJsAudit } from "@/lib/cms/custom-js-guard";
import { errorDetails } from "@/lib/utils/error-response";
import {
  getPageById,
  updatePage,
  deletePage,
  getPageVersions,
  publishPage,
  unpublishPage,
  archivePage
} from "@/lib/models/pages";

function pageValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.message.startsWith("Invalid page data:")) return error.message;
  if (error.message === "Content is required after sanitization") return error.message;
  return undefined;
}

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

    let auditCustomJsWrite = false;
    if ("custom_js" in updateData) {
      const currentPage = await getPageById(id);
      if (!currentPage) {
        return NextResponse.json(
          { success: false, error: "Page not found" },
          { status: 404 },
        );
      }
      if (customJsChanged(updateData, currentPage)) {
        if (isNonEmptyScript(updateData.custom_js)) {
          const allowed = await isSuperAdminActor(authResult);
          if (!allowed) {
            logCustomJsAudit({
              actorUserId: authResult.userId,
              pageId: id,
              action: "update",
              allowed: false,
            });
            return NextResponse.json(
              { success: false, error: "Only a database super-admin may change custom JavaScript." },
              { status: 403 },
            );
          }
        }
        auditCustomJsWrite = true;
      }
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

    if (auditCustomJsWrite) {
      logCustomJsAudit({
        actorUserId: authResult.userId,
        pageId: id,
        action: "update",
        allowed: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedPage,
      message: "Page updated successfully"
    });

  } catch (error) {
    console.error("Error updating page:", error);
    const validationMessage = pageValidationMessage(error);
    if (validationMessage) {
      return NextResponse.json(
        { success: false, error: validationMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update page", ...errorDetails(error) },
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
