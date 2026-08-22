"use client";

import Image from "next/image";
import Link from "next/link";
import { fromWireMoney } from "@/lib/money";
import { resolveProductImageSrc } from "@/lib/utils/product-image";

export default function ProductCard({ product }: { product: any }) {
  // Accepts both stored shapes — flat ({url}) and MACH ({file:{url}}) from the
  // admin editor. Reading only `.url` here made the card fall back to the
  // placeholder for any product saved through the editor. See
  // lib/utils/product-image.ts.
  const imageUrl = resolveProductImageSrc(product.primary_image, product.media, "/placeholder.jpg");
  
  // Get price from first variant. These arrive as MACH wire money (decimal
  // major units), not the minor units Mercora stores.
  const variant = product.variants?.[0];
  const price = fromWireMoney(variant?.price);
  const compareAtPrice = variant?.compare_at_price
    ? fromWireMoney(variant.compare_at_price)
    : null;
  const isOnSale =
    compareAtPrice !== null && compareAtPrice.toMinorUnits() > price.toMinorUnits();

  // Get description from the new structure
  const description = typeof product.description === 'string' ? 
    product.description : 
    (product.description?.en || '');

  return (
    <div className="border rounded-md p-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/product/${product.slug}`} className="flex items-center space-x-2" prefetch={true}>
        {/* Smaller image for drawer */}
        <div className="w-12 h-12 relative shrink-0 overflow-hidden rounded border">
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
            {price.format()}
            {isOnSale && (
              <span className="text-xs text-gray-400 line-through ml-1">
                {compareAtPrice.format()}
              </span>
            )}
          </p>
        </div>
      </Link>
    </div>
  );
}
