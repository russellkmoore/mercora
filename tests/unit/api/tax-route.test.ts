import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/tax/route';

describe('tax API Money boundary', () => {
  it('returns fallback tax as persisted minor-unit Money', async () => {
    const request = new Request('http://localhost/api/tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          productId: 'product-1',
          variantId: 'variant-1',
          name: 'Example',
          price: { amount: 1000, currency: 'USD' },
          quantity: 1,
          primaryImageUrl: '',
        }],
        shippingCost: { amount: 500, currency: 'USD' },
      }),
    });

    const response = await POST(request as never);
    const body = await response.json() as {
      amount: { amount: number; currency: string };
      breakdown: Record<string, { amount: number; currency: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.amount).toEqual({ amount: 70, currency: 'USD' });
    expect(body.breakdown).toEqual({
      subtotal: { amount: 1000, currency: 'USD' },
      shippingCost: { amount: 500, currency: 'USD' },
      taxableAmount: { amount: 1000, currency: 'USD' },
      taxAmount: { amount: 70, currency: 'USD' },
      total: { amount: 1570, currency: 'USD' },
    });
  });
});
