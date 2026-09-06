import { describe, expect, it } from 'vitest';
import { generateOrderConfirmationHTML } from '@/lib/utils/email';
import { getThemeTokens } from '@/lib/themes/tokens';
import { THEME_MANIFEST } from '@/lib/themes/manifest.generated';

describe('order confirmation HTML', () => {
  it('escapes customer, catalog, address, order, and image attribute data', () => {
    const html = generateOrderConfirmationHTML({
      orderNumber: 'WEB-1"><svg/onload=alert(1)>',
      customerName: '<img src=x onerror=alert(1)>',
      customerEmail: 'buyer@example.com',
      items: [{
        productId: 'prod_1',
        name: '<script>alert(1)</script>',
        price: { amount: 1_000, currency: 'USD' },
        quantity: 1,
        imageUrl: 'https://images.example/x" onerror="alert(1)',
      }],
      subtotal: { amount: 1_000, currency: 'USD' },
      shipping: { amount: 0, currency: 'USD' },
      tax: { amount: 0, currency: 'USD' },
      total: { amount: 1_000, currency: 'USD' },
      estimatedDelivery: '<b>tomorrow</b>',
      shippingAddress: {
        street: '<b>1 Main</b>',
        city: '<script>city</script>',
        state: 'CO" onclick="alert(1)',
        zipCode: '<80202>',
        country: 'US&CA',
      },
    }, getThemeTokens());

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;1 Main&lt;/b&gt;');
    expect(html).toContain('&lt;b&gt;tomorrow&lt;/b&gt;');
    expect(html).toContain('US&amp;CA');
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/<img[^>]+\sonerror=/i);
    expect(html).not.toMatch(/<svg/i);
  });
});

describe('token set completeness (UI-SPEC partial row)', () => {
  it('every manifest preset yields a complete 23-key token set — a builder can never receive a partial set', () => {
    for (const preset of THEME_MANIFEST) {
      const tokens = getThemeTokens(preset.name);
      expect(Object.keys(tokens), `preset=${preset.name}`).toHaveLength(23);
    }
  });
});
