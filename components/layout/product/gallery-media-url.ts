/**
 * === Gallery Media URL Helper ===
 *
 * Moved verbatim from `app/product/[slug]/ProductDisplay.tsx`'s local
 * `getMediaUrl` function — same body, same placeholder path, same
 * behavior for a null/undefined input, a string input, an object with a
 * nested file URL, and an object with no usable URL.
 *
 * Shared by both product gallery variants (`ProductGalleryLeft`,
 * `ProductGalleryTop`) so the two can never drift apart on image-URL
 * resolution (D-08).
 *
 * Deliberately NOT swapped for `lib/utils/product-image.ts`'s
 * `resolveProductImageSrc` — the two helpers do not normalise identically,
 * and the default gallery extraction carries a byte-identical obligation
 * (07-RESEARCH.md Open Question 1). That swap is a separate cleanup for a
 * later phase.
 */

export function getMediaUrl(media: any): string {
  if (!media) return "/placeholder.jpg";
  if (typeof media === "string") return media;
  return media.file?.url || "/placeholder.jpg";
}
