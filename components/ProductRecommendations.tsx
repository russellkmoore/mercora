/**
 * Product Recommendations Component - temporarily simplified during MACH migration.
 * The legacy Product type fields don't match MACH schema structure.
 * Needs full rewrite to work with MACH Product schema.
 */

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

interface Props {
  product?: any; // Temporarily accepting any type during migration
  maxRecommendations?: number;
}

export default function ProductRecommendations({ 
  product, 
  maxRecommendations = 3 
}: Props) {
  // MACH migration required - component disabled until updated for MACH Product schema
  console.warn("ProductRecommendations is disabled pending MACH migration.");
  
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-center mb-8">
          Recommended Products
        </h2>
        <div className="text-center text-gray-500">
          <p>Product recommendations are temporarily unavailable during system upgrade.</p>
          <p>Enhanced MACH-powered suggestions coming soon!</p>
        </div>
      </div>
    </section>
  );
}
