"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Category } from "@/lib/types/category";
import type { Product } from "@/lib/types/product";

interface CategoryDisplayProps {
  category: Category;
}

export default function CategoryDisplay({ category }: CategoryDisplayProps) {
  const [sortBy, setSortBy] = useState("featured");

const getEffectivePrice = (p: Product) =>
  p.onSale && p.salePrice != null ? p.salePrice : p.price;

const sortedProducts = [...category.products].sort((a, b) => {
  if (sortBy === "price-high") return getEffectivePrice(b) - getEffectivePrice(a);
  if (sortBy === "price-low") return getEffectivePrice(a) - getEffectivePrice(b);
  if (sortBy === "availability") {
    if (a.availability === b.availability) return 0;
    return a.availability === "available" ? -1 : 1;
  }
  return 0;
});

  return (
    <div className="mx-auto">
      {sortedProducts.length > 0 && (
        <div className="mb-8 flex justify-end">
          <ToggleGroup
            variant="outline"
            type="single"
            value={sortBy}
            onValueChange={(val) => val && setSortBy(val)}
            className="flex flex-wrap gap-0 leading-none border-neutral-700"
          >
            <ToggleGroupItem value="featured" className={toggleClass(sortBy === "featured")}>
              Featured
            </ToggleGroupItem>
            <ToggleGroupItem value="price-high" className={toggleClass(sortBy === "price-high")}>
              Price:<ArrowUp className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="price-low" className={toggleClass(sortBy === "price-low")}>
              Price:<ArrowDown className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="availability" className={toggleClass(sortBy === "availability")}>
              Availability
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {sortedProducts.length > 0 ? (
          sortedProducts.map((product) => <ProductCard key={product.id} product={product} />)
        ) : (
          <div className="col-span-full text-center text-gray-400">
            No products found in this category.
          </div>
        )}
      </section>
    </div>
  );
}

function toggleClass(active: boolean): string {
  return `border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${
    active ? "bg-orange-500 text-black" : ""
  }`;
}
