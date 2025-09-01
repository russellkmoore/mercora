/**
 * Dynamic Page Route - Content Management System
 * 
 * Renders public pages by slug (e.g., /about, /privacy-policy, /terms-of-service).
 * Handles SEO metadata, custom CSS/JS, and responsive content display.
 */

import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPageBySlug } from "@/lib/models/pages";
import PageRenderer from "./PageRenderer";
import { auth } from "@clerk/nextjs/server";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Generate metadata for the page (SEO)
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    
    if (!page) {
      return {
        title: "Page Not Found",
        description: "The requested page could not be found.",
      };
    }

    return {
      title: page.meta_title || page.title,
      description: page.meta_description || page.excerpt || `${page.title} - Mercora`,
      keywords: page.meta_keywords?.split(',').map((k: string) => k.trim()),
      openGraph: {
        title: page.meta_title || page.title,
        description: page.meta_description || page.excerpt || `${page.title} - Mercora`,
        type: 'article',
        publishedTime: page.published_at ? new Date(page.published_at).toISOString() : new Date(page.created_at).toISOString(),
        modifiedTime: new Date(page.updated_at).toISOString(),
      },
      alternates: {
        canonical: `/${page.slug}`,
      },
    };
  } catch (error) {
    console.error("Error generating page metadata:", error);
    return {
      title: "Page Not Found",
      description: "The requested page could not be found.",
    };
  }
}

/**
 * Generate static params for known pages (optional optimization)
 */
export async function generateStaticParams() {
  try {
    // For now, return empty array to use dynamic rendering
    // In production, you might want to pre-generate static paths for published pages
    return [];
  } catch (error) {
    console.error("Error generating static params:", error);
    return [];
  }
}

/**
 * Page component
 */
export default async function PublicPage({ params }: PageProps) {
  try {
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    
    if (!page) {
      notFound();
    }

    // Check if page is protected and requires authentication
    if (page.is_protected) {
      const { userId } = await auth();
      
      if (!userId) {
        // Redirect to sign-in with return URL
        redirect(`/sign-in?redirect_url=/${slug}`);
      }
    }

    return <PageRenderer page={page} />;
    
  } catch (error) {
    console.error("Error loading page:", error);
    notFound();
  }
}