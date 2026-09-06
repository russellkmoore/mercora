/**
 * === HomeHeroSplit ===
 *
 * Copy left, first featured product's image right at `lg` (natural grid
 * auto-placement — no `order-*` utilities); stacked below `lg` via the same
 * natural DOM order. Delegates to `HomeHeroMinimal` when there is no
 * featured product, so the empty case stays a complete hero rather than an
 * image element with nothing to show (UI-SPEC, supersedes RESEARCH
 * assumption A1's placeholder-image recommendation).
 *
 * The image source is always the first featured product's primary image,
 * resolved through the same shared `resolveProductImageSrc` helper
 * `ProductCard` already uses — never read from settings or any store-config
 * field.
 */

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { resolveProductImageSrc } from "@/lib/utils/product-image";
import HomeHeroMinimal from "./HomeHeroMinimal";

interface HomeHeroSplitProps {
  featuredProduct: Product | null;
}

export default function HomeHeroSplit({ featuredProduct }: HomeHeroSplitProps) {
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
      data-home-hero="split"
      className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16 sm:mb-20"
    >
      <div className="text-left">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight uppercase mb-4 sm:mb-6 leading-tight font-display">
          This Gear Powers Your Next Escape
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mb-6 sm:mb-8">
          High-performance electric gear, rugged and designed for the edge of
          the map. Modular. Adaptable. Voltique.
        </p>
        <Link href="/category/featured" className="inline-block">
          <button className="px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold border border-primary text-primary hover:bg-primary hover:text-on-primary transition rounded">
            Shop Featured Gear
          </button>
        </Link>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-elevated">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
