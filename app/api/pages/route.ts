/**
 * Public Pages API - Content Management System
 * 
 * Handles public access to published pages.
 * No authentication required for public content.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublishedPages, getNavigationPages, searchPages } from "@/lib/models/pages";

/**
 * GET /api/pages - Get published pages for public access
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const navOnly = searchParams.get('nav_only') === 'true';
    const limit = searchParams.get('limit');

    // Handle search
    if (search) {
      const results = await searchPages(search, {
        includeUnpublished: false, // Only published pages for public
        limit: limit ? parseInt(limit) : 10
      });
      
      return NextResponse.json({
        success: true,
        data: results
      });
    }

    // Get navigation pages only
    if (navOnly) {
      const pages = await getNavigationPages();
      return NextResponse.json({
        success: true,
        data: pages
      });
    }

    // Get all published pages
    const pages = await getPublishedPages();

    return NextResponse.json({
      success: true,
      data: pages
    });

  } catch (error) {
    console.error("Error fetching public pages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}