'use client';

import ProductCard from "@/components/ProductCard";

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  primaryImageUrl: string;
  price: number;
  salePrice: number;
  onSale?: boolean;
  availability: string;
};

export default function ProductRecommendations({ product }: { product?: Product }) {
  const recommendedProducts = [1, 2, 3].map((item) => ({
    id: item,
    name: `Voltique Item ${item}`,
    slug: `voltique-item-${item}`,
    description: "Premium electric performance. Built for the extremes.",
    primaryImageUrl: "products/placeholder.png",
    price: 1999,
    salePrice: 1499,
    onSale: true,
    availability: "available",
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
          <ProductCard key={prod.id} {...prod} />
        ))}
      </div>
    </div>
  );
}
