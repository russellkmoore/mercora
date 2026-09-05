/**
 * === HomeHeroMinimal (default home hero) ===
 *
 * A verbatim extraction of `app/page.tsx`'s pre-Phase-7 hero section — same
 * element, same class strings, same copy, same CTA. The only difference from
 * the pre-extraction recording
 * (tests/unit/components/layout/home/__snapshots__/home-hero-minimal-preextraction.txt)
 * is the `data-home-hero` attribute on the section's opening tag, whose
 * remainder still matches character for character.
 *
 * Ignores its `featuredProduct` prop entirely — the centred-text hero has no
 * image dependency. This is also the delegation target `HomeHeroSplit` and
 * `HomeHeroFullBleed` render when there is no featured product to show.
 */

import Link from "next/link";
import type { Product } from "@/lib/types";

interface HomeHeroMinimalProps {
  featuredProduct: Product | null;
}

export default function HomeHeroMinimal({
  featuredProduct: _featuredProduct,
}: HomeHeroMinimalProps) {
  return (
    <section data-home-hero="minimal" className="max-w-6xl mx-auto text-center mb-16 sm:mb-20">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight uppercase mb-4 sm:mb-6 leading-tight font-display">
        This Gear Powers Your Next Escape
      </h1>
      <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
        High-performance electric gear, rugged and designed for the edge of
        the map. Modular. Adaptable. Voltique.
      </p>
      <Link href="/category/featured" className="inline-block">
        <button className="px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold border border-primary text-primary hover:bg-primary hover:text-on-primary transition rounded">
          Shop Featured Gear
        </button>
      </Link>
    </section>
  );
}
