/**
 * === Category Page Component ===
 *
 * Dynamic page component that displays a product category with its associated
 * products. Features hero imagery, category information, and product grid
 * with sorting and filtering capabilities.
 *
 * === Features ===
 * - **Dynamic Routing**: Uses [slug] parameter to identify category
 * - **Hero Section**: Large category image with overlay text
 * - **Product Grid**: Displays all products in the category with sorting
 * - **Error Handling**: Graceful error handling for missing categories/products
 * - **Image Optimization**: Next.js Image component with proper sizing
 * - **Responsive Design**: Mobile-first layout with proper breakpoints
 * - **SEO Friendly**: Proper heading hierarchy and semantic markup
 *
 * === Technical Implementation ===
 * - **Server Component**: Server-side data fetching for optimal performance
 * - **Dynamic Image URLs**: Handles multiple image URL formats (string/object)
 * - **MACH Alliance**: Uses MACH-compliant data models
 * - **Error Boundaries**: Proper error handling and user feedback
 * - **Type Safety**: Handles multiple data type possibilities
 *
 * === Data Flow ===
 * 1. Extract category slug from URL parameters
 * 2. Fetch category data by slug
 * 3. Fetch products associated with the category
 * 4. Render hero section with category image/info
 * 5. Display products using CategoryDisplay component
 *
 * === Route ===
 * - Path: `/category/[slug]`
 * - Examples: `/category/camping`, `/category/tools`
 *
 * @param params - URL parameters containing category slug
 * @returns JSX element with category page layout
 */

import { getCategoryBySlug } from "@/lib/models";
import { getProductsByCategory } from "@/lib/models/mach/products";
import CategoryDisplay from "./CategoryDisplay";
import Image from "next/image";

/**
 * Category page component that displays products for a specific category
 * 
 * @param params - URL parameters object containing the category slug
 * @returns Server-rendered category page with products
 */
export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  
  if (!category) {
    return <div>Category not found for slug: {params.slug}</div>;
  }
  
  let products: any[] = [];
  let error: string | null = null;
  
  try {
    products = await getProductsByCategory(category.id as string);
  } catch (e: any) {
    error = e?.message || 'Unknown error';
  }
  
  /**
   * Helper function to extract category image URL from various data formats
   * Handles both string URLs and Media object structures
   * 
   * @returns Formatted image URL or null if no image available
   */
  const getCategoryImageUrl = (): string | null => {
    if (!category.primary_image) return null;
    
    // Handle direct string URLs
    if (typeof category.primary_image === "string") {
      return category.primary_image;
    }
    
    // Handle Media object with nested URL structure
    if (typeof category.primary_image === "object") {
      const imageUrl = (category.primary_image as any).url || category.primary_image.file?.url || null;
      
      // Construct full R2 URL for relative paths
      if (imageUrl && !imageUrl.startsWith('http')) {
        return `https://voltique-images.russellkmoore.me/${imageUrl}`;
      }
      return imageUrl;
    }
    
    return null;
  };

  const categoryImageUrl = getCategoryImageUrl();

  return (
    <div className="mx-auto px-4 sm:px-6">
      
      {/* Category Hero Image */}
      {categoryImageUrl && (
        <div className="relative w-full h-64 sm:h-80 lg:h-96 mb-8 rounded-lg overflow-hidden">
          <Image
            src={categoryImageUrl}
            alt={typeof category.name === 'string' ? category.name : (category.name?.en || 'Category')}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 100vw, 100vw"
            priority={true}
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
            <div className="p-6 sm:p-8 text-white">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                {typeof category.name === 'string' ? category.name : (category.name?.en || 'Category')}
              </h1>
              {category.description && (
                <p className="text-gray-200 text-lg max-w-2xl">
                  {typeof category.description === 'string' ? category.description : (category.description?.en || '')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Header (fallback if no image) */}
      {!categoryImageUrl && (
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {typeof category.name === 'string' ? category.name : (category.name?.en || 'Category')}
          </h1>
          {category.description && (
            <p className="text-gray-400 max-w-2xl mx-auto">
              {typeof category.description === 'string' ? category.description : (category.description?.en || '')}
            </p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-center py-8">
          <p className="text-red-400">Error loading products: {error}</p>
        </div>
      )}

      {/* Products Grid with Sorting */}
      {!error && (
        <CategoryDisplay products={products} />
      )}
    </div>
  );
}