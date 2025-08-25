"use client";

import Image from "next/image";
import Link from "next/link";

export default function ProductCard({ product }: { product: any }) {
  // Extract primary image URL from the new product structure
  const imageUrl = product.primary_image?.url || product.media?.[0]?.url || "/placeholder.jpg";
  
  // Get price from first variant
  const variant = product.variants?.[0];
  const price = variant?.price?.amount || 0;
  const compareAtPrice = variant?.compare_at_price?.amount;
  const isOnSale = compareAtPrice && compareAtPrice > price;
  const displayPrice = price / 100;

  // Get description from the new structure
  const description = typeof product.description === 'string' ? 
    product.description : 
    (product.description?.en || '');

  return (
    <div className="border rounded-md p-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/product/${product.slug}`} className="flex items-center space-x-2" prefetch={true}>
        {/* Smaller image for drawer */}
        <div className="w-12 h-12 relative flex-shrink-0 overflow-hidden rounded border">
          <Image
            src={imageUrl}
            alt={product.name || 'Product'}
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* Smaller, more compact text */}
          <h4 className="text-xs font-semibold truncate text-gray-900">{product.name}</h4>
          <p className="text-xs text-gray-500 truncate">
            {description.length > 60 ? description.substring(0, 60) + '...' : description}
          </p>
          <p className="text-xs font-medium text-orange-600 mt-0.5">
            ${displayPrice.toFixed(2)}
            {isOnSale && (
              <span className="text-xs text-gray-400 line-through ml-1">
                ${(compareAtPrice / 100).toFixed(2)}
              </span>
            )}
          </p>
        </div>
      </Link>
    </div>
  );
}
