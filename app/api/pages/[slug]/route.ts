/**
 * Public Page Detail API - Content Management System
 * 
 * Handles public access to individual published pages by slug.
 * No authentication required for public content.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug } from "@/lib/models/pages";

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

    // Don't expose internal fields for public access
    const publicPage = {
      id: page.id,
      title: page.title,
      slug: page.slug,
      content: page.content,
      excerpt: page.excerpt,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      meta_keywords: page.meta_keywords,
      template: page.template,
      published_at: page.published_at,
      updated_at: page.updated_at,
      nav_title: page.nav_title,
      custom_css: page.custom_css,
      custom_js: page.custom_js
    };

    return NextResponse.json({
      success: true,
      data: publicPage
    });

  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}