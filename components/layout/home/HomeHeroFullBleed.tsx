/**
 * === HomeHeroFullBleed ===
 *
 * A fixed-height band escaping the page's horizontal padding, the first
 * featured product's image filling the band behind a scrim, with the copy
 * overlaid. Reuses the category page's own hero-band height scale
 * (`h-64 sm:h-80 lg:h-96`). Delegates to `HomeHeroMinimal` when there is no
 * featured product (UI-SPEC, supersedes RESEARCH assumption A1's
 * placeholder-image recommendation).
 *
 * The image source is always the first featured product's primary image,
 * resolved through the same shared `resolveProductImageSrc` helper
 * `ProductCard` already uses — never read from settings or any store-config
 * field.
 *
 * === The phase's one literal-colour exception ===
 * No token pair guarantees a dark backdrop under every theme polarity —
 * Phase 6 already proved a token-relative scrim reads as a *light* backdrop
 * under a light preset (the exact defect its own light-preset QA pass caught
 * for Dialog/AlertDialog/Sheet). A photo-behind-text hero needs a scrim that
 * reads dark regardless of theme, which only a literal colour can guarantee.
 * The scrim and its two overlaid text lines are fenced below with the
 * scanner's inline region sentinel; the CTA button stays outside the region
 * and fully token-driven, because its own contrast is already guaranteed by
 * the token contract.
 */

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { resolveProductImageSrc } from "@/lib/utils/product-image";
import HomeHeroMinimal from "./HomeHeroMinimal";

interface HomeHeroFullBleedProps {
  featuredProduct: Product | null;
}

export default function HomeHeroFullBleed({ featuredProduct }: HomeHeroFullBleedProps) {
  if (!featuredProduct) {
    return <HomeHeroMinimal featuredProduct={null} />;
  }

  const imageUrl = resolveProductImageSrc(
    featuredProduct.primary_image,
    featuredProduct.media,
    "/products/placeholder.png",
  );
  const name =
    typeof featuredProduct.name === "string"
      ? featuredProduct.name
      : Object.values(featuredProduct.name || {})[0] || "";

  return (
    <section
      data-home-hero="full-bleed"
      className="relative w-full h-64 sm:h-80 lg:h-96 -mx-4 sm:-mx-6 lg:-mx-12 overflow-hidden mb-16 sm:mb-20"
    >
      <Image
        src={imageUrl}
        alt={name}
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 flex items-end p-6 sm:p-8 lg:p-12">
        <div className="relative">
          {/* gsd:scan-ignore-start -- a photo-behind-text hero scrim and its two overlaid text lines must stay legible across every theme's polarity; no token pair guarantees a dark backdrop under both a light and a dark preset (Phase 6 already proved this for Dialog/AlertDialog/Sheet's light-preset scrims) -- see 07-UI-SPEC.md */}
          <div className="absolute inset-0 bg-black/50" />
          <h1 className="relative text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight uppercase mb-4 sm:mb-6 leading-tight font-display text-white">
            This Gear Powers Your Next Escape
          </h1>
          <p className="relative text-white/80 text-base sm:text-lg max-w-2xl mb-6 sm:mb-8">
            High-performance electric gear, rugged and designed for the edge of
            the map. Modular. Adaptable. Voltique.
          </p>
          {/* gsd:scan-ignore-end */}
          <Link href="/category/featured" className="relative inline-block">
            <button className="px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold bg-primary text-on-primary hover:bg-primary/90 transition rounded">
              Shop Featured Gear
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
