/**
 * Public Page Detail API - Content Management System
 * 
 * Handles public access to individual published pages by slug.
 * No authentication required for public content.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug } from "@/lib/models/pages";
import { toPublicPage } from "@/lib/cms/public-page";

/**
 * GET /api/pages/[slug] - Get published page by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Page slug is required" },
        { status: 400 }
      );
    }

    const page = await getPageBySlug(slug, false); // Only published pages

    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toPublicPage(page)
    });

  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}
