"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowUp, ArrowDown } from "lucide-react";


interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  primaryImageUrl: string | null;
  price: number | null;
  salePrice: number | null;
  onSale?: boolean;
  availability: string;
}

interface CategoryDisplayProps {
  initialProducts: Product[];
}

export default function CategoryDisplay({ initialProducts }: CategoryDisplayProps) {
  const [sortBy, setSortBy] = useState("featured");

  const sortedProducts = [...initialProducts].sort((a, b) => {
    if (sortBy === "price-high") {
      return (b.salePrice ?? b.price ?? 0) - (a.salePrice ?? a.price ?? 0);
    }
    if (sortBy === "price-low") {
      return (a.salePrice ?? a.price ?? 0) - (b.salePrice ?? b.price ?? 0);
    }
    if (sortBy === "availability") {
      if (a.availability === b.availability) return 0;
      return a.availability === "available" ? -1 : 1;
    }
    return 0;
  });

  return (
    <div className="mx-auto">
     <div className="mb-8 flex justify-end">
        <ToggleGroup
            variant="outline"
            type="single"
            value={sortBy}
            onValueChange={(val) => val && setSortBy(val)}
            className="flex flex-wrap gap-0 leading-none border-neutral-700">
            <ToggleGroupItem
            value="featured"
            className={`border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${sortBy === "featured" ? "bg-orange-500 text-black" : ""}`}
            >
            Featured
            </ToggleGroupItem>
            <ToggleGroupItem
            value="price-high"
            className={`border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${sortBy === "price-high" ? "bg-orange-500 text-black" : ""}`}
            >
            Price:<ArrowUp className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
            value="price-low"
            className={`border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${sortBy === "price-low" ? "bg-orange-500 text-black" : ""}`}
            >
            Price:<ArrowDown className="w-4 h-4" /> 
            </ToggleGroupItem>
            <ToggleGroupItem
            value="availability"
            className={`border-neutral-700 h-auto leading-none text-xs font-semibold px-2 py-2 hover:bg-orange-400/20 transition-colors duration-200 ${sortBy === "availability" ? "bg-orange-500 text-black" : ""}`}
            >
            Availability
            </ToggleGroupItem>
        </ToggleGroup>
    </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {sortedProducts.length > 0 ? (
          sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              description={product.description ?? ""}
              primaryImageUrl={product.primaryImageUrl ?? ""}
              price={product.price}
              salePrice={product.salePrice}
              onSale={product.onSale ?? false}
              availability={product.availability}
            />
          ))
        ) : (
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center text-gray-400">
            No products found in this category.
          </div>
        )}
      </section>
    </div>
  );
}
