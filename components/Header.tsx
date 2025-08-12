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

import { getCategories } from "@/lib/loaders/categories";
import HeaderClient from "./HeaderClient";
import { unstable_cache } from "next/cache";

// Cache categories for better performance
const getCachedCategories = unstable_cache(
  async () => getCategories(),
  ['header-categories'],
  { revalidate: 3600 } // Cache for 1 hour
);

/**
 * Server-side Header component that fetches categories and renders HeaderClient
 * 
 * @returns Promise<JSX.Element> Server-rendered header with category data
 */
export default async function Header() {
  // Fetch categories on the server for optimal performance with caching
  const categories = await getCachedCategories();
  
  // Pass categories to client component for interactive functionality
  return <HeaderClient categories={categories} />;
}
