/**
 * === CategoryGrid2 ===
 *
 * The two-column category variant (D-06). Larger cards come from fewer
 * columns and wider gaps, per UI-SPEC's Storefront Variant Anatomy — the
 * same `ProductCard` component, capped at two columns at `lg` and beyond.
 */

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types/";

interface CategoryGrid2Props {
  products: Product[];
}

export default function CategoryGrid2({ products }: CategoryGrid2Props) {
  return (
    <section
      data-category-layout="grid-2"
      className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 lg:gap-12"
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
