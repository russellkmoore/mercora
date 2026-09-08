import { revalidateTag } from "next/cache";

/** Tag on the cached category list the storefront header renders. */
export const CATEGORY_NAV_CACHE_TAG = "category-nav";

/**
 * Expire the header's cached category list so an admin category change shows
 * in the storefront nav on the next request instead of after the hourly TTL.
 * Cache invalidation must never fail a category write, so errors are logged.
 */
export function revalidateCategoryNav(): void {
  try {
    revalidateTag(CATEGORY_NAV_CACHE_TAG, { expire: 0 });
  } catch (error) {
    console.warn("Category nav cache revalidation skipped:", error);
  }
}
