"use client";


import { useState, useMemo } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import type { ProductWithImages } from "@/lib/loaders/products";

type CategoryDisplayProduct = Product | ProductWithImages;

interface CategoryDisplayProps {
  products: CategoryDisplayProduct[];
}

// Helper to get display name (default to 'en' or first available)
function getDisplayName(product: Product, locale = 'en') {
  if (typeof product.name === 'string') return product.name;
  return product.name?.[locale] || Object.values(product.name || {})[0] || '';
}

// Helper to get price (from default variant)
function getDisplayPrice(product: Product): number {
  // Try to get price from default_variant or first variant
  const variants = product.variants || [];
  const defaultVariant = variants.find(v => v.id === product.default_variant_id) || variants[0];
  if (defaultVariant && defaultVariant.price && typeof defaultVariant.price === 'object') {
    return defaultVariant.price.amount || 0;
  }
  return 0;
}


  const [sort, setSort] = useState<string>("relevance");

  // Sorting logic (price, name, etc.)
  const sortedProducts = useMemo(() => {
    if (sort === "price-asc") {
      return [...products].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    }
    if (sort === "price-desc") {
      return [...products].sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    }
    if (sort === "name-asc") {
      return [...products].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    }
    if (sort === "name-desc") {
      return [...products].sort((a, b) => getDisplayName(b).localeCompare(getDisplayName(a)));
    }
    // Default: relevance (original order)
    return products;
  }, [products, sort]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Products</h2>
        <select
          className="bg-neutral-800 text-white border border-neutral-700 rounded px-2 py-1"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="relevance">Relevance</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A-Z</option>
          <option value="name-desc">Name: Z-A</option>
        </select>
      </div>
      {sortedProducts.length === 0 ? (
        <div className="text-gray-400 text-center py-12">No products found in this category.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedProducts.map(product => (
            <ProductCard key={product.id} product={product as any} />
          ))}
        </div>
      )}
    </div>
  );
}
