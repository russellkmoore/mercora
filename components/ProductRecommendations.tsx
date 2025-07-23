'use client';

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types/product";
import { act } from "react";

export default function ProductRecommendations({ product }: { product?: Product }) {
  const recommendedProducts = [1, 2, 3].map((item) => ({
    id: item,
    name: `Voltique Item ${item}`,
    slug: `voltique-item-${item}`,
    shortDescription: "High-performance electric product.",
    longDescription: "This Voltique item is designed for premium electric performance and built for the extremes. Enjoy advanced features and reliability.",
    primaryImageUrl: "products/placeholder.png",
    images: ["products/placeholder.png"],
    price: 1999,
    salePrice: 1499,
    onSale: true,
    availability: "available" as const,
    quantityInStock: 10,
    category: "Electronics",
    brand: "Voltique",
    rating: 4.5,
    tags: ["electric", "performance", "premium"],
    useCases: ["outdoor", "travel", "daily"],
    active: true,
    attributes: {
      color: "black",
      weight: "2kg",
      batteryLife: "12h"
    }
  }));

  return (
    <div className="mt-20 text-center relative">
      <div className="border-t border-neutral-700 w-full relative mb-10">
        <span className="text-orange-400 text-2xl font-semibold bg-neutral-900 px-4 absolute -top-4 left-1/2 transform -translate-x-1/2 font-serif">
          You may also like
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {recommendedProducts.map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </div>
    </div>
  );
}
