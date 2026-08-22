/**
 * Unit tests for product image resolution.
 *
 * `products.primary_image` holds two shapes: the flat `{url, alt_text}` the
 * Shopify ETL wrote, and the MACH `{type, file: {url}, accessibility}` the admin
 * editor writes. The product cards read `img.url` alone, so saving a product
 * through /admin/products silently replaced its card image with
 * `/placeholder.svg` — on the homepage, the category pages, and Chai's cards —
 * while the PDP kept rendering it, because ProductDisplay already read both.
 *
 * These pin BOTH shapes in both fields. The card is the only place a customer
 * sees the catalog before clicking, so a silent fallback here is invisible in
 * exactly the way this was.
 */
import { describe, it, expect } from 'vitest';

import { resolveProductImageUrl, resolveProductImageSrc } from '@/lib/utils/product-image';

const FLAT = { url: 'products/x.jpg', alt_text: 'X' };
const MACH = {
  type: 'image',
  file: { url: 'products/x.jpg', format: 'jpg' },
  accessibility: { alt_text: 'X' },
};

describe('resolveProductImageUrl', () => {
  it('reads the flat ETL shape', () => {
    expect(resolveProductImageUrl(FLAT)).toBe('products/x.jpg');
  });

  it('reads the MACH shape the admin editor writes', () => {
    expect(resolveProductImageUrl(MACH)).toBe('products/x.jpg');
  });

  it('parses either shape out of an unparsed JSON string', () => {
    expect(resolveProductImageUrl(JSON.stringify(FLAT))).toBe('products/x.jpg');
    expect(resolveProductImageUrl(JSON.stringify(MACH))).toBe('products/x.jpg');
  });

  it('falls back to media when there is no primary image', () => {
    expect(resolveProductImageUrl(null, [MACH])).toBe('products/x.jpg');
    expect(resolveProductImageUrl(undefined, [FLAT])).toBe('products/x.jpg');
    expect(resolveProductImageUrl(null, JSON.stringify([FLAT]))).toBe('products/x.jpg');
  });

  it('skips media entries that carry no url', () => {
    expect(resolveProductImageUrl(null, [{ type: 'image' }, FLAT])).toBe('products/x.jpg');
  });

  it('treats a bare string as the path it is', () => {
    // Some rows store the key directly rather than a record.
    expect(resolveProductImageUrl('products/x.jpg')).toBe('products/x.jpg');
  });

  it('returns null when nothing resolves', () => {
    // '{broken' looks like JSON and fails to parse — the only string form that
    // is not a usable path.
    for (const empty of [null, undefined, '', '   ', {}, { file: {} }, '{broken', []]) {
      expect(resolveProductImageUrl(empty)).toBeNull();
    }
    expect(resolveProductImageUrl(null, [])).toBeNull();
    expect(resolveProductImageUrl(null, 'nonsense')).toBeNull();
  });
});

describe('resolveProductImageSrc', () => {
  it('roots an R2 key so the image loader can resolve it', () => {
    // R2 keys are stored without a leading slash.
    expect(resolveProductImageSrc(FLAT)).toBe('/products/x.jpg');
    expect(resolveProductImageSrc(MACH)).toBe('/products/x.jpg');
  });

  it('leaves absolute paths and external URLs alone', () => {
    expect(resolveProductImageSrc({ url: '/already-rooted.jpg' })).toBe('/already-rooted.jpg');
    expect(resolveProductImageSrc({ url: 'https://cdn.example.com/x.jpg' })).toBe(
      'https://cdn.example.com/x.jpg'
    );
  });

  it('falls back to the placeholder rather than an empty src', () => {
    expect(resolveProductImageSrc(null)).toBe('/placeholder.svg');
    expect(resolveProductImageSrc({ file: {} }, [])).toBe('/placeholder.svg');
  });
});
