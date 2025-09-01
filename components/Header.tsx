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
 * Header (Server) → getCategories() → HeaderClient (Client)
 * ```
 *
 * === Data Flow ===
 * 1. Server component fetches categories from database
 * 2. Categories passed as props to client component
 * 3. Client component handles interactivity and state
 *
 * === Usage ===
 * ```tsx
 * <Header />
 * ```
 * 
 * No props required - this is a top-level server component.
 */

import { listCategories } from "@/lib/models";
import { getNavigationPages } from "@/lib/models/pages";
import HeaderClient from "./HeaderClient";
import { unstable_cache } from "next/cache";

// Cache categories for better performance
const getCachedCategories = unstable_cache(
  async () => listCategories(),
  ['header-categories'],
  { revalidate: 3600 } // Cache for 1 hour
);

// Cache navigation pages for better performance
const getCachedNavigationPages = unstable_cache(
  async () => getNavigationPages(),
  ['header-navigation-pages'],
  { revalidate: 3600 } // Cache for 1 hour
);

/**
 * Server-side Header component that fetches categories and navigation pages and renders HeaderClient
 * 
 * @returns Promise<JSX.Element> Server-rendered header with category and page data
 */
export default async function Header() {
  // Fetch both categories and navigation pages on the server for optimal performance with caching
  const [categories, navigationPages] = await Promise.all([
    getCachedCategories(),
    getCachedNavigationPages()
  ]);
  
  // Pass data to client component for interactive functionality
  return <HeaderClient categories={categories} navigationPages={navigationPages} />;
}
