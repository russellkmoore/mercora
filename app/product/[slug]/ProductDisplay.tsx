"use client";

import { useState } from "react";
import Image from "next/image";
import ProductRecommendations from "@/components/ProductRecommendations";
import { useCartStore } from "@/lib/stores/cart-store";
import { toast } from "sonner";
import type { Product } from "@/lib/types/product";

export default function ProductDisplay({ product }: { product: Product }) {
  const [selectedImage, setSelectedImage] = useState(product.primaryImageUrl);

  const formatImageSrc = (src: string | null) =>
    src?.startsWith("http") ? src : `/${src || "placeholder.jpg"}`;

  const allImages = Array.from(
    new Set([product.primaryImageUrl, ...product.images].filter(Boolean))
  ) as string[];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <div className="relative w-full rounded overflow-hidden bg-neutral-800 aspect-[3/4]">
            <Image
              src={formatImageSrc(selectedImage)}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              style={{ objectFit: "cover" }}
              className="object-cover"
            />
          </div>

          <div className="flex gap-3 mt-4">
            {allImages.map((img, idx) => (
              <div
                key={`thumb-${idx}`}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 relative rounded overflow-hidden cursor-pointer border ${
                  selectedImage === img
                    ? "border-orange-500"
                    : "border-gray-700"
                }`}
              >
                <Image
                  src={formatImageSrc(img)}
                  alt={`Thumbnail ${idx}`}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold mb-4">{product.name}</h1>
          <p className="text-gray-400 mb-6">{product.longDescription}</p>

          {product.salePrice && product.onSale ? (
            <div className="mb-4">
              <p className="text-gray-500 line-through text-lg">
                ${(product.price / 100).toFixed(2)}
              </p>
              <p className="text-green-400 text-xl font-bold">
                ${(product.salePrice / 100).toFixed(2)}
              </p>
              <p className="text-sm text-orange-400 italic">on sale</p>
            </div>
          ) : (
            <p className="text-xl font-semibold text-white mb-4">
              ${(product.price / 100).toFixed(2)}
            </p>
          )}

          {product.quantityInStock > 0 &&
          product.availability === "available" ? (
            <button
              className="mt-6 px-6 py-3 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition"
              onClick={() => {
                useCartStore.getState().addItem({
                  productId: product.id,
                  name: product.name,
                  price:
                    (product.onSale && product.salePrice
                      ? product.salePrice
                      : product.price) / 100,
                  quantity: 1,
                  primaryImageUrl: product.primaryImageUrl ?? "placeholder.jpg",
                });
                toast("Added to Cart", {
                  description: `${product.name} has been added to your cart.`,
                  icon: "🔥",
                });
              }}
            >
              Add to Cart
            </button>
          ) : (
            <p className="text-orange-500 font-semibold text-xl mb-4">
              Coming soon
            </p>
          )}
        </div>
      </div>

      <ProductRecommendations product={product} />
    </>
  );
}
