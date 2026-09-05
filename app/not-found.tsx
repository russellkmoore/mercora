import Link from "next/link";

/**
 * Custom not-found boundary.
 *
 * Next.js ships a built-in fallback for routes that call `notFound()`
 * without a nearby `not-found.tsx` (see
 * `next/dist/client/components/http-access-fallback/error-fallback.js`).
 * That fallback injects its own unlayered `<style>` (`body{color:#000;
 * background:#fff}` outside any `@layer`), which beats our token-driven
 * Tailwind utility classes in the cascade regardless of specificity,
 * because Tailwind's utilities live inside `@layer utilities`. Defining
 * this component keeps every `notFound()` call site (category, product,
 * blog, account routes, etc.) on the app's own themed surface instead of
 * silently falling back to a white, unbranded page.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold font-display">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="text-primary underline hover:text-primary/80">
        Return home
      </Link>
    </div>
  );
}
