import { describe, expect, it } from 'vitest';
import { generateOrderStatusUpdateHTML } from '@/lib/utils/email';
import { getThemeTokens } from '@/lib/themes/tokens';

const base = {
  orderNumber: 'WEB-1001',
  customerName: 'Test Customer',
  customerEmail: 'buyer@example.com',
  items: [{
    productId: 'prod_1',
    name: 'Headlamp',
    price: { amount: 1_000, currency: 'USD' },
    quantity: 1,
  }],
  shippingAddress: {
    street: '1 Main St',
    city: 'Denver',
    state: 'CO',
    zipCode: '80202',
    country: 'US',
  },
};

describe('order status update HTML token colours', () => {
  it('never emits an unevaluated ${tokens.*} placeholder', () => {
    const tokens = getThemeTokens();
    for (const status of ['processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'unknown']) {
      const html = generateOrderStatusUpdateHTML({ ...base, status }, tokens);
      expect(html, `status=${status}`).not.toContain('${');
    }
  });

  it('colours the status heading with the matching theme token', () => {
    const tokens = getThemeTokens();
    const cases: Array<[string, string]> = [
      ['processing', tokens.info],
      ['shipped', tokens.success],
      ['cancelled', tokens.danger],
    ];
    for (const [status, colour] of cases) {
      const html = generateOrderStatusUpdateHTML({ ...base, status }, tokens);
      expect(html, `status=${status}`).toContain(`<h2 style="color: ${colour};`);
    }
  });
});
