import { getProductBySlug } from "@/lib/loaders/products";
import Image from "next/image";
import { notFound } from "next/navigation";

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export default async function ProductPage({ params }: any) {
  const product = await getProductBySlug(params.slug);
  if (!product) return notFound();

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative w-full aspect-square rounded overflow-hidden bg-neutral-800">
          {product.primaryImageUrl ? (
            <Image
              src={`/${product.primaryImageUrl}`}
              alt={product.name}
              layout="fill"
              objectFit="cover"
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl">
              No Image
            </div>
          )}
        </div>
        <div>
          <h1 className="text-4xl font-extrabold mb-4">{product.name}</h1>
          <p className="text-gray-400 mb-6">{product.description}</p>
          <p className="text-orange-500 font-semibold text-xl mb-4">
            {product.availability === "available"
              ? "In stock"
              : "Coming soon"}
          </p>
          {product.onSale ? (
            <p className="text-green-400 font-medium">On Sale</p>
          ) : null}
          <button className="mt-6 px-6 py-3 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition">
            Add to Cart
          </button>
        </div>
      </div>
    </main>
  );
}
