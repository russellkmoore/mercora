import { getCategoryBySlug } from "@/lib/models";
import { getProductsByCategory } from "@/lib/models/mach/products";
import CategoryDisplay from "./CategoryDisplay";
import Image from "next/image";

export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  
  if (!category) {
    return <div>Category not found</div>;
  }
  
  let products: any[] = [];
  let error: string | null = null;
  
  try {
    products = await getProductsByCategory(category.id as string);
  } catch (e: any) {
    error = e?.message || 'Unknown error';
  }
  
  // Helper to get category image URL
  const getCategoryImageUrl = (): string | null => {
    return typeof category.primary_image === "string"
      ? category.primary_image
      : category.primary_image?.file?.url || null;
  };

  const categoryImageUrl = getCategoryImageUrl();

  return (
    <div className="mx-auto px-4 sm:px-6">
      {/* Category Hero Image */}
      {categoryImageUrl && (
        <div className="relative w-full h-64 sm:h-80 lg:h-96 mb-8 rounded-lg overflow-hidden">
          <Image
            src={categoryImageUrl}
            alt={typeof category.name === 'string' ? category.name : 'Category'}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 100vw, 100vw"
            priority={true}
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end">
            <div className="p-6 sm:p-8 text-white">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                {typeof category.name === 'string' ? category.name : 'Category'}
              </h1>
              {category.description && (
                <p className="text-gray-200 text-lg max-w-2xl">
                  {typeof category.description === 'string' ? category.description : ''}
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
            {typeof category.name === 'string' ? category.name : 'Category'}
          </h1>
          {category.description && (
            <p className="text-gray-400 max-w-2xl mx-auto">
              {typeof category.description === 'string' ? category.description : ''}
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