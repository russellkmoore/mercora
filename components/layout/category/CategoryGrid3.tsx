/**
 * === CategoryGrid3 (default category layout) ===
 *
 * A verbatim extraction of `CategoryDisplay.tsx`'s pre-Phase-7 products
 * section — same element, same class string, same ternary, same empty-state
 * cell and sentence. The only difference from the pre-extraction recording
 * (tests/unit/components/layout/category/__snapshots__/category-display-grid3.html)
 * is the `data-category-layout` attribute below, which the parity test
 * strips before comparing.
 */

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types/";

interface CategoryGrid3Props {
  products: Product[];
}

export default function CategoryGrid3({ products }: CategoryGrid3Props) {
  return (
    <section
      data-category-layout="grid-3"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10"
    >
      {products.length > 0 ? (
        products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))
      ) : (
        <div className="col-span-full text-center text-muted-foreground py-8">
          No products found in this category.
        </div>
      )}
    </section>
  );
}
