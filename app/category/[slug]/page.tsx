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
        <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
        {category.heroImageUrl && (
          <div className="relative w-full h-64 mb-6 rounded overflow-hidden">
            <Image
              src={`/${category.heroImageUrl}`}
              alt={category.name}
              layout="fill"
              objectFit="cover"
              className="object-cover"
            />
          </div>
        )}
        <p className="text-gray-400 mb-10">{category.description ?? ""}</p>
      </div>

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            slug={product.slug}
            description={product.description ?? ""}
            primaryImageUrl={product.primaryImageUrl}
          />
        ))}
      </section>
    </main>
  );
}