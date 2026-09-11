/**
 * === Home Page Component ===
 *
 * The main landing page component that showcases the brand identity and
 * featured products. Designed to create immediate engagement and drive
 * users deeper into the product catalog.
 *
 * === Features ===
 * - **Hero Section**: Bold branding with compelling value proposition
 * - **Featured Products**: Curated selection of top products (3 items)
 * - **Call-to-Action**: Direct link to featured category for exploration
 * - **Responsive Design**: Mobile-first layout with desktop enhancements
 * - **Brand Voice**: Adventure-focused messaging with technical emphasis
 * - **Visual Hierarchy**: Strategic typography and spacing for impact
 *
 * === Layout Structure ===
 * - **Hero**: Large heading + description + CTA button
 * - **Products Grid**: 3-column responsive grid of featured products
 * - **Responsive**: 1 column mobile, 2 tablet, 3 desktop
 *
 * === Technical Implementation ===
 * - **Server Component**: Static generation for optimal performance
 * - **Data Loading**: Server-side product fetching with category filtering
 * - **SEO Optimized**: Proper heading hierarchy and semantic markup
 * - **Performance**: Minimal client-side JavaScript, fast initial load
 *
 * === Business Logic ===
 * - Displays first 3 products from "featured" category
 * - Drives traffic to full featured category page
 * - Establishes brand positioning and product appeal
 *
 * === Usage ===
 * This is the root page component rendered at "/"
 * 
 * @returns JSX element with complete home page layout
 */

import ProductCard from "@/components/ProductCard";
import { getProductsByCategory } from "@/lib/models/mach/products";
import { toPublicProduct } from "@/lib/models/mach/product-serializer";
import { getLayoutSettings } from "@/lib/layout/settings";
import { HOME_HERO_MAP } from "@/components/layout/home/home-hero-map";
import { getStoreConfig } from "@/lib/store-config";
import { filterListedProducts } from "@/lib/gift-cards/visibility";
import { getContentSettings } from "@/lib/content/settings";
import { getPublishedBlogPosts } from "@/lib/models/blog";
import BlogHighlights from "@/components/home/BlogHighlights";

/**
 * Home page component - main landing page for the application
 *
 * @returns Server-rendered home page with hero section and featured products
 */
export default async function HomePage() {
  // Fetch only 3 featured products with optimized query
  const { giftCardAcquisition } = getStoreConfig().commerce.features;
  const featuredProducts = filterListedProducts(
    (await getProductsByCategory("cat_1")).filter((product) => product.status === "active"),
    { giftCardAcquisition },
  )
    .map(toPublicProduct)
    .slice(0, 3);

  // Resolved server-side, per request, never Suspense-wrapped — a streamed
  // hero choice would paint the wrong layout first (Phase 6 precedent).
  const { homeHero } = await getLayoutSettings();
  const HeroVariant = HOME_HERO_MAP[homeHero];

  // Both fixed slots below render this one resolved element (Phase 16,
  // BLOG-02) — computed once so the block can never appear twice or show
  // different content at each position. A disabled block short-circuits
  // before the query runs; the count that reaches getPublishedBlogPosts
  // arrives already clamped by getContentSettings, not re-checked here.
  const { blogHomeBlockEnabled, blogHomeBlockHeading, blogHomeBlockCount, blogHomeBlockPlacement } =
    await getContentSettings();
  const blogPosts = blogHomeBlockEnabled
    ? await getPublishedBlogPosts({ limit: blogHomeBlockCount, includeHtml: true })
    : [];
  const blogHighlights =
    blogPosts.length > 0 ? <BlogHighlights heading={blogHomeBlockHeading} posts={blogPosts} /> : null;

  return (
    <div className="bg-surface-elevated text-foreground px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      {/* Hero Section — resolved variant (Phase 7, LAYOUT-02) */}
      <HeroVariant featuredProduct={featuredProducts[0] ?? null} />

      {blogHomeBlockPlacement === "before_featured" && blogHighlights}

      {/* Featured Products Grid */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-12 sm:mb-16">
        {featuredProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={index === 0} // Only prioritize the first product image
          />
        ))}
      </section>

      {blogHomeBlockPlacement === "after_featured" && blogHighlights}
    </div>
  );
}

// Enable static generation with revalidation for better performance
export const revalidate = 3600; // Revalidate every hour
