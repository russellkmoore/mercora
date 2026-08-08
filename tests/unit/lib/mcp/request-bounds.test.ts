import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  getProductBySlug: vi.fn(),
}));

vi.mock('@/lib/models/mach/products', () => ({
  searchProducts: mocks.searchProducts,
  getProductBySlug: mocks.getProductBySlug,
}));

import { assessFulfillmentCapability } from '@/lib/mcp/tools/assess';
import { getRecommendations } from '@/lib/mcp/tools/recommend';
import { searchProductsWithContext } from '@/lib/mcp/tools/search';

describe('MCP discovery request bounds', () => {
  it('rejects an empty fulfillment item list without NaN metadata', async () => {
    const result = await assessFulfillmentCapability({
      requirements: { items: [], budget: 0, timeline: '', location: '' },
    }, 'session');
    expect(result.success).toBe(false);
    expect(result.metadata.can_fulfill_percentage).toBe(0);
    expect(Number.isFinite(result.metadata.estimated_satisfaction)).toBe(true);
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('rejects an oversized search query before catalog access', async () => {
    const result = await searchProductsWithContext({ query: 'x'.repeat(257) }, 'session');
    expect(result.success).toBe(false);
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it('rejects non-finite recommendation budgets before catalog access', async () => {
    const result = await getRecommendations({ context: { budget: Number.POSITIVE_INFINITY } }, 'session');
    expect(result.success).toBe(false);
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });
});
