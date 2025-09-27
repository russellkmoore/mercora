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

import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProductsByCategory } from "@/lib/models/mach/products";

/**
 * Home page component - main landing page for the application
 * 
 * @returns Server-rendered home page with hero section and featured products
 */
export default async function HomePage() {
  // Fetch only 3 featured products with optimized query
  const featuredProducts = (await getProductsByCategory("cat_1")).slice(0, 3);

  return (
    <main className="bg-neutral-900 text-white px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto text-center mb-16 sm:mb-20">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight uppercase mb-4 sm:mb-6 leading-tight">
          This Gear Powers Your Next Escape
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
          High-performance electric gear, rugged and designed for the edge of
          the map. Modular. Adaptable. Voltique.
        </p>
        <Link href="/category/featured" className="inline-block">
          <button className="px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black transition rounded">
            Shop Featured Gear
          </button>
        </Link>
      </section>

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
    </main>
  );
}

// Enable static generation with revalidation for better performance
export const revalidate = 3600; // Revalidate every hour
