'use client';

import { useState } from "react";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";

export default function ProductDisplay({ product }: { product: any }) {
  const [selectedImage, setSelectedImage] = useState(product.primaryImageUrl);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <div className="relative w-full aspect-square rounded overflow-hidden bg-neutral-800">
            <Image
              src={`/${selectedImage}`}
              alt={product.name}
              layout="fill"
              objectFit="cover"
              className="object-cover"
            />
          </div>

          <div className="flex gap-3 mt-4">
            {[product.primaryImageUrl, ...product.images].map((img: string, idx: number) => (
              <div
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 relative rounded overflow-hidden cursor-pointer border ${
                  selectedImage === img ? "border-orange-500" : "border-gray-700"
                }`}
              >
                <Image src={`/${img}`} alt="" layout="fill" objectFit="cover" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold mb-4">{product.name}</h1>
          <p className="text-gray-400 mb-6">{product.description}</p>

          {product.quantityInStock > 0 ? (
            <>
              {product.salePrice ? (
                <div className="mb-4">
                  <p className="text-gray-500 line-through text-lg">${product.price / 100}</p>
                  <p className="text-green-400 text-xl font-bold">${product.salePrice / 100}</p>
                  <p className="text-sm text-orange-400 italic">on sale</p>
                </div>
              ) : (
                <p className="text-xl font-semibold text-white mb-4">${product.price / 100}</p>
              )}
            </>
          ) : (
            <p className="text-orange-500 font-semibold text-xl mb-4">Coming soon</p>
          )}

          <button className="mt-6 px-6 py-3 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition">
            Add to Cart
          </button>
        </div>
      </div>

      <div className="mt-20 text-center relative">
        <div className="border-t border-neutral-700 w-full relative mb-10">
          <span className="text-orange-400 text-2xl font-semibold bg-neutral-900 px-4 absolute -top-4 left-1/2 transform -translate-x-1/2 font-serif">
            You may also like
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {[1, 2, 3].map((item) => (
            <ProductCard
              key={item}
              id={item}
              name={`Voltique Item ${item}`}
              slug={`voltique-item-${item}`}
              description="Premium electric performance. Built for the extremes."
              primaryImageUrl="products/placeholder.png"
            />
          ))}
        </div>
      </div>
    </>
  );
}
