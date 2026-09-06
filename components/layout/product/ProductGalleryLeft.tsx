/**
 * === ProductGalleryLeft (default product gallery) ===
 *
 * A verbatim extraction of `app/product/[slug]/ProductDisplay.tsx`'s
 * pre-Phase-7 gallery block — same elements, same class strings, same
 * thumbnail-selection behavior. The only differences from the
 * pre-extraction recording
 * (tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt)
 * are: the `data-product-gallery` attribute on the outer element (whose
 * remainder still matches character for character), and the closure
 * references the recording could only express as `product.name` /
 * `setSelectedImage` — now the `productName` / `onSelect` props the
 * interfaces block specifies. No class string, attribute, or element order
 * changed.
 *
 * Client component: thumbnail selection is client state, owned by
 * `ProductDisplay` and passed down as props, so this variant and
 * `ProductGalleryTop` can never drift apart on image handling (D-08).
 */

"use client";

import Image from "next/image";
import { resolveProductImageSrc } from "@/lib/utils/product-image";

interface ProductGalleryLeftProps {
  allImages: string[];
  selectedImage: string | null;
  onSelect: (url: string) => void;
  productName: string;
}

export default function ProductGalleryLeft({
  allImages,
  selectedImage,
  onSelect,
  productName,
}: ProductGalleryLeftProps) {
  return (
    <div data-product-gallery="left">
      <div className="relative aspect-3/4 w-full overflow-hidden rounded bg-surface-elevated">
        <Image
          src={resolveProductImageSrc(selectedImage, undefined, "/placeholder.jpg")}
          alt={productName}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          style={{ objectFit: "cover" }}
          className="object-cover"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 sm:mt-4 sm:gap-3">
        {allImages.map((imageUrl, index) => (
          <button
            type="button"
            key={`thumb-${index}`}
            onClick={() => onSelect(imageUrl)}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border sm:h-20 sm:w-20 ${
              selectedImage === imageUrl ? "border-primary" : "border-border"
            }`}
          >
            <Image
              src={resolveProductImageSrc(imageUrl, undefined, "/placeholder.jpg")}
              alt={`Thumbnail ${index + 1}`}
              fill
              style={{ objectFit: "cover" }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
