import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getThemeTokens } from '@/lib/themes/tokens';
import { DEFAULT_THEME_NAME } from '@/lib/themes/manifest.generated';

/**
 * D-01 proof (below) mocks `@/lib/utils/settings` (not
 * `@/lib/themes/active-theme`) so the real `getActiveTheme()` ->
 * `resolveEmailTheme()` chain runs, and `@/lib/email/sender` so no real
 * delivery is attempted. Hoisted above the static imports below so both the
 * pure-generator tests and the async-sender tests share one mock module
 * graph.
 */
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/lib/utils/settings', () => ({
  getSettings: mocks.getSettings,
}));
vi.mock('@/lib/email/sender', () => ({
  sendEmail: mocks.send,
}));

import { generateOrderStatusUpdateHTML, sendOrderStatusUpdateEmail } from '@/lib/utils/email';
import { APPEARANCE_THEME_SETTING_KEY } from '@/lib/themes/active-theme';

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

describe('a stored non-default theme reaches the rendered email HTML (D-01)', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({ success: true, id: 'email-1', provider: 'resend' });
  });

  it('renders luxe colour values and none of the manifest default\'s when luxe is the stored theme', async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: 'luxe' });
    const luxeTokens = getThemeTokens('luxe');
    const defaultTokens = getThemeTokens(DEFAULT_THEME_NAME);

    await sendOrderStatusUpdateEmail({ ...base, status: 'shipped' });

    const html = mocks.send.mock.calls[0][0].html as string;
    expect(html).toContain(luxeTokens.surfaceInverse);
    expect(html).toContain(luxeTokens.onInverse);
    expect(html).toContain(luxeTokens.mutedOnInverse);
    expect(html).not.toContain(defaultTokens.surfaceInverse);
    expect(html).not.toContain(defaultTokens.onInverse);
    expect(html).not.toContain(defaultTokens.mutedOnInverse);
  });

  it('ADJACENCY: a stored theme equal to the manifest default renders byte-identical HTML to nothing stored', async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: DEFAULT_THEME_NAME });
    await sendOrderStatusUpdateEmail({ ...base, status: 'shipped' });
    const storedDefaultHtml = mocks.send.mock.calls[0][0].html as string;

    mocks.getSettings.mockResolvedValue({});
    await sendOrderStatusUpdateEmail({ ...base, status: 'shipped' });
    const nothingStoredHtml = mocks.send.mock.calls[1][0].html as string;

    expect(storedDefaultHtml).toBe(nothingStoredHtml);
  });
});
