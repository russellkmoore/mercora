import { getProductBySlug } from "@/lib/models";
import { notFound } from "next/navigation";
import ProductDisplay from "./ProductDisplay";

export default async function ProductPage({ params }: any) {
  const product = await getProductBySlug(params.slug);
  if (!product) return notFound();

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <ProductDisplay product={product} />
      </div>
    </main>
  );
}
