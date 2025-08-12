
import { getCategoryByPath } from "@/lib/loaders/categories";
import { getProductsByCategory } from "@/lib/loaders/products";
import CategoryDisplay from "@/components/CategoryDisplay";
import { notFound } from "next/navigation";
import type { Category, Media } from "@/lib/types";

export default async function CategoryPage({ params }: any) {
  // Convert slug to path format for MACH compatibility
  const categoryPath = `/${params.slug}`;
  const category = await getCategoryByPath(categoryPath);
  if (!category) return notFound();

  // Load products for this category (by slug or path)
  const products = await getProductsByCategory(params.slug);

  // Get display name for current locale (defaulting to 'en')
  const categoryName = typeof category.name === 'object' 
    ? category.name['en'] || Object.values(category.name)[0]
    : category.name;
  const categoryDescription = category.description && typeof category.description === 'object'
    ? category.description['en'] || Object.values(category.description)[0]
    : category.description;

  // MACH hero image logic: prefer primary_image, then extensions.banner_image, then first media image
  let heroImageUrl: string | undefined = undefined;
  let heroImageAlt: string | undefined = undefined;
  if (category.primary_image && category.primary_image.file?.url) {
    heroImageUrl = category.primary_image.file.url;
    heroImageAlt = category.primary_image.accessibility?.alt_text || categoryName;
  } else if (category.extensions?.merchandising?.banner_image) {
    heroImageUrl = category.extensions.merchandising.banner_image;
    heroImageAlt = category.extensions.merchandising.promotional_badge?.en || categoryName;
  } else if (Array.isArray(category.media) && category.media.length > 0) {
    const firstImage = category.media.find((m: Media) => m.file?.url);
    if (firstImage) {
      heroImageUrl = firstImage.file.url;
      heroImageAlt = firstImage.accessibility?.alt_text || categoryName;
    }
  }

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto mb-8 sm:mb-12">
        <div className="relative w-full h-48 sm:h-64 lg:h-96 mb-4 sm:mb-6 rounded overflow-hidden bg-gradient-to-r from-orange-500/20 to-red-500/20">
          {heroImageUrl && (
            <img
              src={heroImageUrl}
              alt={heroImageAlt || categoryName}
              className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-80"
              style={{ filter: 'blur(0px) brightness(0.85)' }}
            />
          )}
          <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-t from-neutral-900 to-transparent" />
          <h1 className="absolute top-2 sm:top-4 right-4 sm:right-6 text-2xl sm:text-3xl lg:text-5xl font-extrabold text-white select-none drop-shadow-md z-10">
            {categoryName}
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-10 px-2 sm:px-0">
          {categoryDescription || ""}
        </p>
      </div>

      {/* MACH Category Products */}
      <div className="max-w-6xl mx-auto">
        <CategoryDisplay products={products} />
      </div>
import CategoryDisplay from "@/components/CategoryDisplay";
    </main>
  );
}
