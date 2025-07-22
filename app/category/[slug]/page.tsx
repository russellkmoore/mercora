import { getCategoryBySlug } from "@/lib/loaders/categories";
import { getProductsByCategory } from "@/lib/loaders/products";
import ProductCard from "@/components/ProductCard";
import Image from "next/image";
import { notFound } from "next/navigation";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return notFound();

  const products = await getProductsByCategory(params.slug);

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

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        { products.length > 0 ?
          ( products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              description={product.description ?? ""}
              primaryImageUrl={product.primaryImageUrl}
            />
          ))):
          (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center text-gray-400">
              No products found in this category.
            </div>
          )
        }
      </section>
    </main>
  );
}