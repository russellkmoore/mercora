/**
 * Public Pages API - Content Management System
 * 
 * Handles public access to published pages.
 * No authentication required for public content.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublishedPages, getNavigationPages, searchPages } from "@/lib/models/pages";
import { toPublicPageSummary } from "@/lib/cms/public-page";

function boundedLimit(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 10;
  return Math.min(50, Math.max(1, Number(value)));
}

function boundedOffset(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0;
  return Math.min(10_000, Number(value));
}

/**
 * GET /api/pages - Get published pages for public access
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const navOnly = searchParams.get('nav_only') === 'true';
    const limit = boundedLimit(searchParams.get('limit'));
    const offset = boundedOffset(searchParams.get('offset'));

    // Handle search
    if (search) {
      if (search.length > 100) {
        return NextResponse.json({ success: false, error: "Search is too long" }, { status: 400 });
      }
      const results = await searchPages(search, {
        includeUnpublished: false, // Only published pages for public
        limit,
        offset,
      });
      
      return NextResponse.json({
        success: true,
        data: results.map(toPublicPageSummary)
      });
    }

    // Get navigation pages only
    if (navOnly) {
      const pages = await getNavigationPages({ limit, offset });
      return NextResponse.json({
        success: true,
        data: pages.map(toPublicPageSummary)
      });
    }

    // Get all published pages
    const pages = await getPublishedPages({ limit, offset });

    return NextResponse.json({
      success: true,
      data: pages.map(toPublicPageSummary)
    });

  } catch (error) {
    console.error("Error fetching public pages:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}
