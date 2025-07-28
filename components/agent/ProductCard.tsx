"use client";

import Image from "next/image";
import Link from "next/link";

export default function ProductCard({ product }: { product: any }) {
  return (
    <div className="border rounded p-3 bg-white shadow-sm">
      <Link href={`/product/${product.slug}`} className="flex items-center space-x-3">
        <div className="w-16 h-16 relative flex-shrink-0 overflow-hidden rounded border">
          <Image
            src={product.primaryImageUrl || "/placeholder.jpg"}
            alt={product.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{product.name}</h4>
          <p className="text-xs text-gray-500 truncate">
            {product.shortDescription}
          </p>
          <p className="text-sm font-medium text-orange-500 mt-1">
            ${(product.onSale ? product.salePrice : product.price) / 100}
          </p>
        </div>
      </Link>
    </div>
  );
}
