/**
 * === Loading Components ===
 *
 * Reusable loading states and skeleton components to improve perceived
 * performance while content is being fetched or rendered.
 */

/**
 * ProductCard Skeleton Loader
 */
export function ProductCardSkeleton() {
  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden shadow animate-pulse">
      <div className="relative aspect-video bg-neutral-700" />
      <div className="p-3 sm:p-4">
        <div className="h-6 bg-neutral-700 rounded mb-2" />
        <div className="h-4 bg-neutral-700 rounded mb-2 w-3/4" />
        <div className="h-4 bg-neutral-700 rounded mb-4 w-1/2" />
        <div className="h-5 bg-neutral-700 rounded w-1/3" />
      </div>
    </div>
  );
}

/**
 * Product Grid Skeleton
 */
export function ProductGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </section>
  );
}

/**
 * Page Loading Spinner
 */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );
}
