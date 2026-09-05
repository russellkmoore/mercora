/**
 * === ProductGalleryTop ===
 *
 * The full-width product gallery variant (D-08): the main image spans the
 * full content width above the information block, with the same
 * horizontally scrolling thumbnail strip as `ProductGalleryLeft` below it —
 * now spanning the full width instead of half. Same four shared gallery
 * props, same selection behavior, same selected/unselected thumbnail
 * treatment; only the geometry differs.
 *
 * `ProductDisplay` renders this variant inside a stacked (non-grid)
 * container and caps the info column at `max-w-2xl` for readability rather
 * than stretching it full-bleed — see `PRODUCT_GALLERY_LAYOUT` there.
 *
 * Client component: thumbnail selection is client state, owned by
 * `ProductDisplay` and passed down as props, so this variant and
 * `ProductGalleryLeft` can never drift apart on image handling (D-08).
 */

"use client";

import Image from "next/image";
import { resolveProductImageSrc } from "@/lib/utils/product-image";

interface ProductGalleryTopProps {
  allImages: string[];
  selectedImage: string | null;
  onSelect: (url: string) => void;
  productName: string;
}

export default function ProductGalleryTop({
  allImages,
  selectedImage,
  onSelect,
  productName,
}: ProductGalleryTopProps) {
  return (
    <div data-product-gallery="top">
      <div className="relative w-full aspect-video overflow-hidden rounded bg-surface-elevated">
        <Image
          src={resolveProductImageSrc(selectedImage, undefined, "/placeholder.jpg")}
          alt={productName}
          fill
          sizes="100vw"
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
