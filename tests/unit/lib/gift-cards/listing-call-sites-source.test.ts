import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/**
 * The public listing call sites routed through the shared predicate. Every
 * entry here must import from the visibility module — none may re-derive
 * `product.type === 'gift_card'` inline (T-13-07).
 *
 * This list is hard-coded, which means it can only ever catch a call site
 * that stops using the predicate, never one that was never added. `app/api/
 * agent-chat/route.ts` was exactly that miss: D-07 names "Volt's product
 * results", and Volt is the drawer a shopper actually talks to, but it
 * hydrates from Drizzle directly and was not in the original nine.
 */
const PUBLIC_LISTING_CALL_SITES = [
  'app/api/products/route.ts',
  'app/api/agent-chat/route.ts',
  'app/page.tsx',
  'app/category/[slug]/page.tsx',
  'lib/recommendations/index.ts',
  'lib/mcp/catalog.ts',
  'lib/mcp/tools/search.ts',
  'lib/mcp/tools/assess.ts',
  'lib/mcp/tools/recommend.ts',
  'lib/cms/page-products.ts',
];

const VISIBILITY_MODULE_PATH = 'gift-cards/visibility';

describe('public listing call sites import the shared gift-card visibility predicate (T-13-07)', () => {
  for (const path of PUBLIC_LISTING_CALL_SITES) {
    it(`${path} imports from ${VISIBILITY_MODULE_PATH}`, () => {
      expect(read(path)).toContain(VISIBILITY_MODULE_PATH);
    });
  }
});

describe('the model layer never re-implements gift-card visibility (D-14, T-13-06)', () => {
  // The admin product manager and phase 14 share listProducts, searchProducts
  // and getProductsByCategory. If any of the predicate names below ever
  // appear in this file, the gift card would silently disappear from
  // /admin/products too — filtering belongs at the public call sites only.
  const FORBIDDEN_VISIBILITY_IDENTIFIERS = [
    'GIFT_CARD_PRODUCT_TYPE',
    'GiftCardVisibilityFeatures',
    'hidesGiftCardsFromListings',
    'isPubliclyVisibleProduct',
    'filterListedProducts',
    'giftCardSurfacesHidden',
  ];

  it('lib/models/mach/products.ts contains none of the visibility predicate exports', () => {
    const source = read('lib/models/mach/products.ts');
    // Strip comment lines so this file's own inline documentation of the
    // rule (if any is ever added) cannot satisfy the assertion by accident.
    const codeOnly = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');

    for (const identifier of FORBIDDEN_VISIBILITY_IDENTIFIERS) {
      expect(codeOnly).not.toContain(identifier);
    }
  });
});
