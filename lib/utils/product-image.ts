/**
 * === Product image URL resolution (pure) ===
 *
 * `products.primary_image` and `products.media` hold TWO shapes, and both are
 * legitimate:
 *
 *   flat (Shopify ETL):  { "url": "products/x.jpg", "alt_text": "..." }
 *   MACH (admin editor): { "type": "image", "file": { "url": "products/x.jpg",
 *                          "format": "jpg" }, "accessibility": { ... } }
 *
 * Reading only one of them is how the storefront lost every product image on the
 * homepage: the cards read `img.url` alone, so the moment a product was saved
 * through /admin/products (which writes the MACH shape) its card fell back to
 * `/placeholder.svg`. The PDP kept working the whole time because
 * ProductDisplay already read `?.url || ?.file?.url`, which is why this looked
 * like an image-hosting problem rather than a shape mismatch.
 *
 * Rather than rewrite the stored data, every reader resolves through here. A
 * migration could normalize the rows, but it would only hold until the next
 * writer disagreed; accepting both shapes is what actually keeps the images on
 * the page.
 *
 * PURE ON PURPOSE - no imports. Both product cards are client components.
 */

/**
 * One image record in either shape, or a JSON string of one, or a bare path.
 * Also accepts a `src` key as a third fallback, for records that carry the URL
 * under that name.
 */
function urlFromImageRecord(image: unknown): string | null {
  if (!image) return null;

  if (typeof image === 'string') {
    const trimmed = image.trim();
    if (trimmed === '') return null;
    // A column read that skipped JSON parsing, or a bare path/URL.
    if (trimmed.startsWith('{')) {
      try {
        return urlFromImageRecord(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    return trimmed;
  }

  if (typeof image !== 'object') return null;

  const record = image as Record<string, any>;
  const candidates = [record.url, record.file?.url, record.src];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * The display URL for a product's image, from its `primary_image` with `media`
 * as a fallback, or `null` when neither carries one. Accepts either stored
 * shape, in either field.
 */
export function resolveProductImageUrl(
  primaryImage: unknown,
  media?: unknown
): string | null {
  const primary = urlFromImageRecord(primaryImage);
  if (primary) return primary;

  let items: unknown = media;
  if (typeof items === 'string' && items.trim().startsWith('[')) {
    try {
      items = JSON.parse(items);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const url = urlFromImageRecord(item);
    if (url) return url;
  }

  return null;
}

/**
 * The same resolution, returning a `src` ready for the Image component: a
 * root-relative path, falling back to the placeholder. R2 keys are stored
 * without a leading slash (`products/x.jpg`) and the image loader expects one.
 */
export function resolveProductImageSrc(
  primaryImage: unknown,
  media?: unknown,
  placeholder = '/placeholder.svg'
): string {
  const url = resolveProductImageUrl(primaryImage, media);
  if (!url) return placeholder;
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return `/${url}`;
}
