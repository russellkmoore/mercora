import { getCategoryBySlug } from "@/lib/models";
import { notFound } from "next/navigation";
import CategoryDisplay from "./CategoryDisplay";
import Image from "next/image";
import type { Category } from "@/lib/types/";

export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return notFound();

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto mb-8 sm:mb-12">
        <div className="relative w-full h-48 sm:h-64 lg:h-96 mb-4 sm:mb-6 rounded overflow-hidden">
          {category.primary_image && (
            <>
              <Image
                src={`/${category.primary_image}`}
                alt={typeof category.name === "string" ? category.name : ""}
                layout="fill"
                objectFit="cover"
                sizes="100vw"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-t from-neutral-900 to-transparent" />
              <h1 className="absolute top-2 sm:top-4 right-4 sm:right-6 text-2xl sm:text-3xl lg:text-5xl font-extrabold text-white select-none drop-shadow-md z-10">
                {typeof category.name === "string" ? category.name : ""}
              </h1>
            </>
          )}
        </div>
        <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-10 px-2 sm:px-0">
          {typeof category.description === "string"
            ? category.description
            : category.description
            ? JSON.stringify(category.description)
            : ""}
        </p>
      </div>

      <CategoryDisplay category={category} />
    </main>
  );
}
