import { getCategoryBySlug } from "@/lib/loaders/categories";
import { notFound } from "next/navigation";
import CategoryDisplay from "./CategoryDisplay";
import Image from "next/image";
import type { Category } from "@/lib/types/category";

export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return notFound();

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
      <div className="max-w-6xl mx-auto mb-12">
        <div className="relative w-full h-96 mb-6 rounded overflow-hidden">
          {category.heroImageUrl && (
            <>
              <Image
                src={`/${category.heroImageUrl}`}
                alt={category.name}
                layout="fill"
                objectFit="cover"
                className="object-cover"
                priority
              />
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-neutral-900 to-transparent" />
              <h1 className="absolute top-4 right-6 text-5xl font-extrabold text-white select-none drop-shadow-md z-10">
                {category.name}
              </h1>
            </>
          )}
        </div>
        <p className="text-gray-400 mb-10">{category.description ?? ""}</p>
      </div>

      <CategoryDisplay category={category} />
    </main>
  );
}
