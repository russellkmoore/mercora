import ProductCard from "@/components/ProductCard";
import { getProductsByCategory } from "@/lib/loaders/products";

export default async function HomePage() {
  const featuredProducts = (await getProductsByCategory("featured")).slice(
    0,
    3
  );

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
      <section className="max-w-6xl mx-auto text-center mb-20">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight uppercase mb-6">
          This Gear Powers Your Next Escape
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
          High-performance electric gear, rugged and designed for the edge of
          the map. Modular. Adaptable. Voltique.
        </p>
        <a href="/category/featured">
          <button className="px-6 py-3 text-lg font-semibold border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black transition rounded">
            Shop Featured Gear
          </button>
        </a>
      </section>

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {featuredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </main>
  );
}
