'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types/product';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const {
    id,
    name,
    slug,
    shortDescription,
    primaryImageUrl,
    price,
    salePrice,
    onSale = false,
    availability,
  } = product;

  return (
    <Link href={`/product/${slug}`}>
      <div className="bg-neutral-800 rounded-lg overflow-hidden shadow hover:shadow-lg transition cursor-pointer">
        <div className="relative aspect-video bg-neutral-700">
          {primaryImageUrl ? (
            <Image
              src={`/${primaryImageUrl}`}
              alt={name}
              layout="fill"
              objectFit="cover"
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl">
              No Image
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-xl font-semibold mb-2">{name}</h3>
          <p className="text-gray-400 text-sm mb-2 line-clamp-3">{shortDescription}</p>
          {price !== null && (
            <div className="text-sm">
              {onSale && salePrice != null ? (
                <div className="text-green-400">
                  <span className="line-through text-gray-400 mr-2">
                    ${(price / 100).toFixed(2)}
                  </span>
                  <span className="font-semibold">
                    ${(salePrice / 100).toFixed(2)}
                  </span>
                  <span className="ml-2 text-xs text-orange-500 font-bold">
                    On Sale
                  </span>
                </div>
              ) : (
                <div className="text-white font-semibold">
                  ${(price / 100).toFixed(2)}
                </div>
              )}
            </div>
          )}
          <p className={`mt-2 text-xs ${availability === 'available' ? 'text-green-400' : 'text-orange-500'}`}>
            {availability === 'available' ? 'In Stock' : 'Coming Soon'}
          </p>

          <a href={`/product/${slug}`} className="text-orange-500 hover:underline text-sm font-medium">
            Learn more →
          </a>
        </div>
      </div>
    </Link>
  );
}
