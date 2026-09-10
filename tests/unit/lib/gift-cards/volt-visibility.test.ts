import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * D-07 names "Volt's product results and recommendations" as a listing surface.
 * The original plan read that as the MCP tools only, so `/api/agent-chat` — the
 * drawer a shopper actually talks to — kept returning the gift card under
 * sell=off, and under both flags off returned a card linking to a page that now
 * 404s. This file covers both readings of "Volt": the MCP search tool
 * behaviourally, and the chat route's two filters as a source contract, since
 * that route needs AI and Vectorize bindings to run at all.
 */

vi.mock('@/lib/models/mach/products', () => ({ searchProducts: vi.fn() }));
vi.mock('@/lib/store-config', () => ({ getStoreConfig: vi.fn() }));

import { searchProductsWithContext } from '@/lib/mcp/tools/search';
import { searchProducts } from '@/lib/models/mach/products';
import { getStoreConfig } from '@/lib/store-config';

const variant = {
  id: 'variant_1',
  sku: 'SKU-1',
  option_values: [],
  price: { amount: 2_500, currency: 'USD' },
  inventory: { track_inventory: false, quantity: 0 },
  status: 'active',
};

const boots = {
  id: 'product_boots',
  name: 'Trail boots',
  slug: 'trail-boots',
  status: 'active',
  type: 'physical',
  variants: [variant],
};

const giftCard = {
  id: 'product_gift_card',
  name: 'Gift card',
  slug: 'gift-card',
  status: 'active',
  type: 'gift_card',
  variants: [variant],
};

function setSell(giftCardAcquisition: boolean) {
  vi.mocked(getStoreConfig).mockReturnValue({
    commerce: { features: { giftCardAcquisition, giftCardReconciliation: true } },
  } as never);
}

describe('MCP search applies the public gift-card visibility predicate (D-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchProducts).mockResolvedValue([boots, giftCard] as never);
  });

  it('drops the gift card from agent search results while selling is off', async () => {
    setSell(false);
    const response = await searchProductsWithContext(
      { query: 'something as a gift' } as never,
      'session_1',
    );

    expect(response.success).toBe(true);
    expect(response.data?.map((product) => product.id)).toEqual(['product_boots']);
  });

  it('returns the gift card while selling is on, so the filter is the flag and not a blanket ban', async () => {
    setSell(true);
    const response = await searchProductsWithContext(
      { query: 'something as a gift' } as never,
      'session_1',
    );

    expect(response.data?.map((product) => product.id))
      .toEqual(['product_boots', 'product_gift_card']);
  });
});

describe('the chat route filters both the products it returns and the copy it retrieves', () => {
  const source = readFileSync(
    join(process.cwd(), 'app/api/agent-chat/route.ts'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('routes hydrated product rows through the shared predicate before projection', () => {
    expect(source).toMatch(/import \{[\s\S]*?filterListedProducts[\s\S]*?\} from ["']@\/lib\/gift-cards\/visibility["']/);
    // Filtered before the variant hydration and projection, not after: the
    // projection is what becomes a product card in the drawer.
    expect(source).toMatch(/filterListedProducts\(productResults[\s\S]{0,200}?visibleResults\.map/);
  });

  it('strips hidden gift-card ids from the Vectorize matches feeding the model', () => {
    // Retrieval context is not a recommendation, but the model reads it: fed
    // gift-card copy it will describe a product the store says does not exist.
    expect(source).toContain('hiddenGiftCardProductIds');
    expect(source).toMatch(/visibleMatches[\s\S]{0,400}?contextSnippets = visibleMatches/);
    expect(source).toMatch(/productIds = visibleMatches/);
  });

  it('runs no visibility lookup at all while selling is on', () => {
    // The ordinary case must not pay for a query, so the guard is the
    // predicate itself and returns before reaching the database.
    expect(source).toMatch(/hidesGiftCardsFromListings\(\{ giftCardAcquisition \}\)\) return new Set\(\)/);
  });
});
