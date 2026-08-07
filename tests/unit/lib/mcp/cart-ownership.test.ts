import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mcp/session', () => ({
  requireOwnedSession: vi.fn(),
  updateSessionCart: vi.fn(),
}));
vi.mock('@/lib/models/mach/products', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/models/mach/products')>()),
  getProductBySlug: vi.fn(),
}));

import { requireOwnedSession, updateSessionCart } from '@/lib/mcp/session';
import { getProductBySlug } from '@/lib/models/mach/products';
import {
  addToCart,
  bulkAddToCart,
  clearCart,
  getCartEstimate,
  removeFromCart,
  updateCart,
} from '@/lib/mcp/tools/cart';

const denied = {
  ok: false as const,
  code: 'SESSION_ACCESS_DENIED' as const,
  message: 'Agent does not own this session',
};

beforeEach(() => vi.clearAllMocks());

describe('MCP cart ownership', () => {
  it.each([
    ['add', () => addToCart({ productId: 1, variantId: 1, sessionId: 's' }, 's', 'attacker')],
    ['bulk add', () => bulkAddToCart({ items: [], sessionId: 's' }, 's', 'attacker')],
    ['clear', () => clearCart('s', 'attacker')],
    ['update', () => updateCart({ productId: 1, variantId: 1, sessionId: 's' }, 's', 'attacker')],
    ['remove', () => removeFromCart({ productId: 1, variantId: 1, sessionId: 's' }, 's', 'attacker')],
    ['estimate', () => getCartEstimate('s', 'attacker')],
  ])('%s rejects a session owned by another agent before reading or mutating it', async (_name, run) => {
    vi.mocked(requireOwnedSession).mockResolvedValue(denied);
    const result = await run();
    expect(result.error?.code).toBe('SESSION_ACCESS_DENIED');
    expect(updateSessionCart).not.toHaveBeenCalled();
    expect(getProductBySlug).not.toHaveBeenCalled();
  });

  it('rejects an empty bulk request without emitting NaN fulfillment metadata', async () => {
    vi.mocked(requireOwnedSession).mockResolvedValue({
      ok: true,
      session: {
        sessionId: 's',
        agentId: 'agent',
        userContext: { agentId: 'agent' },
        cart: [],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    const result = await bulkAddToCart({ items: [], sessionId: 's' }, 's', 'agent');
    expect(result.success).toBe(false);
    expect(result.metadata.can_fulfill_percentage).toBe(0);
    expect(Number.isNaN(result.metadata.can_fulfill_percentage)).toBe(false);
    expect(updateSessionCart).not.toHaveBeenCalled();
  });
});
