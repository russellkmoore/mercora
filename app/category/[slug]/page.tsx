import { getCategoryByPath } from "@/lib/loaders/categories";
import { notFound } from "next/navigation";
import type { Category } from "@/lib/types";

export default async function CategoryPage({ params }: any) {
  // Convert slug to path format for MACH compatibility
  const categoryPath = `/${params.slug}`;
  const category = await getCategoryByPath(categoryPath);
  if (!category) return notFound();

  // Get display name for current locale (defaulting to 'en')
  const categoryName = typeof category.name === 'object' 
    ? category.name['en'] || Object.values(category.name)[0]
    : category.name;
    
  const categoryDescription = category.description && typeof category.description === 'object'
    ? category.description['en'] || Object.values(category.description)[0]
    : category.description;

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto mb-8 sm:mb-12">
        <div className="relative w-full h-48 sm:h-64 lg:h-96 mb-4 sm:mb-6 rounded overflow-hidden bg-gradient-to-r from-orange-500/20 to-red-500/20">
          <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-t from-neutral-900 to-transparent" />
          <h1 className="absolute top-2 sm:top-4 right-4 sm:right-6 text-2xl sm:text-3xl lg:text-5xl font-extrabold text-white select-none drop-shadow-md z-10">
            {categoryName}
          </h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-10 px-2 sm:px-0">
          {categoryDescription || ""}
        </p>
      </div>

      {/* MACH Category Products - To be implemented */}
      <div className="max-w-6xl mx-auto text-center">
        <div className="bg-neutral-800 rounded-lg p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Category Products</h2>
          <p className="text-gray-400 mb-4">
            MACH-compliant product loading for category "{categoryName}" coming soon.
          </p>
          <div className="text-sm text-gray-500">
            <p>Category ID: {category.id}</p>
            <p>Category Path: {category.path}</p>
            <p>Status: {category.status}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
