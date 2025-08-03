import { getProductBySlug } from "@/lib/loaders/products";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamic import for ProductDisplay to prevent hydration issues
const ProductDisplay = dynamic(() => import("./ProductDisplay"), {
  ssr: false,
  loading: () => (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery Skeleton */}
        <div>
          <div className="relative w-full rounded overflow-hidden bg-neutral-800 aspect-[3/4]"></div>
          <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-800 rounded"></div>
            ))}
          </div>
        </div>
        {/* Product Details Skeleton */}
        <div className="space-y-4">
          <div className="h-8 bg-neutral-800 rounded w-3/4"></div>
          <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-neutral-800 rounded"></div>
            <div className="h-4 bg-neutral-800 rounded w-5/6"></div>
            <div className="h-4 bg-neutral-800 rounded w-4/6"></div>
          </div>
          <div className="h-6 bg-neutral-800 rounded w-1/4"></div>
          <div className="h-12 bg-neutral-800 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
});

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
