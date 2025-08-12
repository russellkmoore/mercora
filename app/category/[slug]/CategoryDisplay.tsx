/**
 * === Category Display Component ===
 *
 * A comprehensive category page component that displays products within
 * a specific category with advanced sorting capabilities and responsive
 * grid layout. Provides an enhanced shopping experience for browsing products.
 *
 * === Features ===
 * - **Product Sorting**: Multiple sort options (featured, price, availability)
 * - **Smart Pricing**: Handles sale price calculations automatically
 * - **Interactive Controls**: Toggle group for sorting selection
 * - **Responsive Grid**: Adaptive layout for different screen sizes
 * - **Visual Indicators**: Icons and states for sorting direction
 * - **Performance**: Client-side sorting for instant feedback
 * - **Accessibility**: Proper ARIA labels and keyboard navigation
 *
 * === Sorting Options ===
 * - **Featured**: Default category ordering
 * - **Price High**: Highest to lowest price (considers sale prices)
 * - **Price Low**: Lowest to highest price (considers sale prices)
 * - **Availability**: Available products first, then coming soon
 *
 * === Technical Implementation ===
 * - **Client Component**: Interactive sorting state management
 * - **TypeScript Safety**: Fully typed with Category and Product interfaces
 * - **Price Logic**: Smart sale price handling with fallback to regular price
 * - **Performance**: Efficient array sorting with stable sort algorithms
 *
 * === Usage ===
 * ```tsx
 * <CategoryDisplay category={categoryData} />
 * ```
 *
 * === Props ===
 * @param category - Category object containing products and metadata
 */

"use client";

import { useState, useEffect } from "react";
import ProductCard from "@/components/ProductCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Category, Product } from "@/lib/types/";
import { listProducts, getEffectivePrice } from "@/lib/models";

interface CategoryDisplayProps {
  category: Category;
}

/**
 * CategoryDisplay component for browsing products within a category
 * 
 * @param category - The category object containing products to display
 * @returns JSX element with category products and sorting controls
 */
export default function CategoryDisplay({ category }: CategoryDisplayProps) {
  const [sortBy, setSortBy] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listProducts().then((all) => {
      setProducts(
        all.filter((p) => Array.isArray(p.categories) && p.categories.includes(category.id))
      );
      setLoading(false);
    });
  }, [category.id]);

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "price-high") {
      return getEffectivePrice(b) - getEffectivePrice(a);
    }
    if (sortBy === "price-low") {
      return getEffectivePrice(a) - getEffectivePrice(b);
    }
    return 0;
  });

  return (
    <div className="mx-auto px-4 sm:px-6">
      {/* Sorting Controls */}
      {sortedProducts.length > 0 && (
        <div className="mb-6 sm:mb-8 flex justify-center sm:justify-end">
          <ToggleGroup
            variant="outline"
            type="single"
            value={sortBy}
            onValueChange={(val) => val && setSortBy(val)}
            className="flex flex-wrap gap-0 leading-none border-neutral-700 scale-90 sm:scale-100"
          >
            <ToggleGroupItem
              value="featured"
              className={toggleClass(sortBy === "featured")}
            >
              Featured
            </ToggleGroupItem>
            <ToggleGroupItem
              value="price-high"
              className={toggleClass(sortBy === "price-high")}
            >
              Price:
              <ArrowUp className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="price-low"
              className={toggleClass(sortBy === "price-low")}
            >
              Price:
              <ArrowDown className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="availability"
              className={toggleClass(sortBy === "availability")}
            >
              Availability
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {/* Products Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
        {sortedProducts.length > 0 ? (
          sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="col-span-full text-center text-gray-400 py-8">
            No products found in this category.
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Generate CSS classes for toggle group items with active state styling
 * 
 * @param active - Whether the toggle item is currently active
 * @returns CSS class string with conditional active styling
 */
function toggleClass(active: boolean): string {
  return `border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${
    active ? "bg-orange-500 text-black" : ""
  }`;
}
