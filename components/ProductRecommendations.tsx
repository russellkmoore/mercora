/** Server-resolved PDP recommendations with no client fetch or loading state. */
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export default function ProductRecommendations({
  recommendations,
}: {
  recommendations: Product[];
}) {
  if (recommendations.length === 0) return null;

  const gridClass =
    recommendations.length === 1
      ? "grid-cols-1 max-w-sm mx-auto"
      : recommendations.length === 2
        ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="relative mt-20 text-center" aria-labelledby="recommendations-title">
      <div className="relative mb-10 w-full border-t border-neutral-700">
        <h2
          id="recommendations-title"
          className="absolute -top-4 left-1/2 -translate-x-1/2 bg-neutral-900 px-4 font-serif text-xl font-semibold text-orange-400"
        >
          You may also like
        </h2>
      </div>
      <div className={`grid gap-10 ${gridClass}`}>
        {recommendations.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
