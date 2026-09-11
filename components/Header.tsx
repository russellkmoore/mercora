/**
 * === Header Component (Server) ===
 *
 * Server-side header component that fetches category data and passes it to the
 * client-side HeaderClient component. Implements the RSC (React Server Component)
 * pattern for optimal performance and SEO.
 *
 * === Features ===
 * - **Server-Side Rendering**: Fetches data on the server for better performance
 * - **Category Loading**: Loads all product categories for navigation
 * - **Data Passing**: Efficiently passes server data to client components
 * - **SEO Optimization**: Server-rendered content for better search indexing
 *
 * === Architecture ===
 * ```
 * Header (Server) → getCategories() / getContentSettings() / getPublishedBlogPosts() → HeaderClient (Client)
 * ```
 *
 * === Data Flow ===
 * 1. Server component fetches categories from database
 * 2. Server component resolves the blog nav label and whether any article is
 *    published (collapsed to a boolean before it leaves the server)
 * 3. Categories, blog nav visibility, and blog nav label passed as props to
 *    client component
 * 4. Client component handles interactivity and state
 *
 * === Usage ===
 * ```tsx
 * <Header />
 * ```
 *
 * No props required - this is a top-level server component.
 */

import { listCategories } from "@/lib/models";
import HeaderClient from "./HeaderClient";
import { unstable_cache } from "next/cache";
import { CATEGORY_NAV_CACHE_TAG } from "@/lib/cache-tags";
import { getContentSettings } from "@/lib/content/settings";
import { getPublishedBlogPosts } from "@/lib/models/blog";

// Cache categories for an hour; admin category writes expire the tag early.
const getCachedCategories = unstable_cache(
  async () => listCategories(),
  ['header-categories'],
  { revalidate: 3600, tags: [CATEGORY_NAV_CACHE_TAG] }
);

/**
 * Server-side Header component that fetches categories and renders HeaderClient
 * 
 * @returns Promise<JSX.Element> Server-rendered header with category data
 */
export default async function Header() {
  // Fetch categories on the server for optimal performance with caching
  const categories = await getCachedCategories();

  // Resolve the blog nav label and whether any article is published.
  // getPublishedBlogPosts already excludes drafts and future-dated posts;
  // the result is collapsed to a boolean here so no post row ever crosses
  // into the client component (T-16-11).
  const { blogNavLabel } = await getContentSettings();

  // A blog-table read failure must degrade the nav link, not the whole
  // page — Header renders on every route via the root layout, with no
  // error boundary above it that can catch a thrown promise. Mirrors
  // getContentSettings()'s own D-17 posture for the identical reason.
  let showBlogNav = false;
  try {
    showBlogNav = (await getPublishedBlogPosts({ limit: 1 })).length > 0;
  } catch {
    // Degrade to "no blog nav entry" rather than crashing the header.
  }

  // Pass data to client component for interactive functionality
  return (
    <HeaderClient
      categories={categories}
      showBlogNav={showBlogNav}
      blogNavLabel={blogNavLabel}
    />
  );
}
