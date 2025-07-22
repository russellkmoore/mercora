import { getCategoryBySlug } from "@/lib/loaders/categories";
import { getProductsByCategory } from "@/lib/loaders/products";
import { notFound } from "next/navigation";
import CategoryDisplay from "./CategoryDisplay";
import Image from "next/image";


export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return notFound();

  const products = await getProductsByCategory(params.slug);

  // Ensure onSale and active are boolean, not null, and description is string or undefined
  const normalizedProducts = products.map((product) => ({
    ...product,
    onSale: product.onSale ?? false,
    active: product.active ?? false,
    description: product.description ?? undefined,
  }));

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
              {/* Fade effect */}
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-neutral-900 to-transparent" />

              {/* Category name overlay */}
              <h1 className="absolute top-4 right-6 text-5xl font-extrabold text-white select-none drop-shadow-md z-10">
                {category.name}
              </h1>
            </>
          )}
        </div>
        <p className="text-gray-400 mb-10">{category.description ?? ""}</p>
      </div>

    <CategoryDisplay initialProducts={normalizedProducts} />
    </main>
  );
}
