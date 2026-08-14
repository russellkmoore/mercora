import { describe, expect, it, vi } from 'vitest';
import type { CanonicalFacts } from '@/lib/ai/canonical-facts';
import {
  classifyQuery,
  DETERMINISTIC_CATEGORIES,
  resolveDeterministicAnswer,
  type DeterministicAnswerDependencies,
} from '@/lib/ai/deterministic-answers';

const facts: CanonicalFacts = {
  storeName: 'Example Store',
  assistantName: 'Example Guide',
  locale: 'de-DE',
  currency: 'EUR',
  supportEmail: 'help@example.test',
  supportHours: 'weekdays, 9–5',
  businessAddress: '1 Example Way',
  siteUrl: 'https://example.test',
  orderHistoryUrl: 'https://example.test/account/orders',
  returnsUrl: 'https://example.test/returns',
  allowedHosts: ['example.test'],
  allowedEmails: ['help@example.test'],
};

function dependencies(overrides: Partial<DeterministicAnswerDependencies> = {}) {
  return {
    getRefundPolicy: vi.fn().mockResolvedValue({ returnWindowDays: 30 }),
    resolveShippingOptions: vi.fn().mockResolvedValue({
      options: [
        { id: 'ground', label: 'Ground', cost: { amount: 450, currency: 'EUR' }, estimatedDays: 6 },
        { id: 'air', label: 'Air (2 days)', cost: { amount: 1200, currency: 'EUR' }, estimatedDays: 2 },
      ],
      qualifiesForFreeShipping: false,
      freeShippingThresholdMajor: 90,
      freeMethodIds: ['ground'],
    }),
    ...overrides,
  } as DeterministicAnswerDependencies;
}

describe('classifyQuery', () => {
  it.each([
    ['What email should I use to contact support?', 'contact_email'],
    ['Where is my order?', 'order_status'],
    ['What is your business address?', 'business_address'],
    ['How many days do I have to return this?', 'refund_window'],
    ['What are your shipping rates?', 'shipping_rates'],
  ])('classifies %j as %s', (question, category) => {
    expect(classifyQuery(question)).toBe(category);
  });

  it('keeps contact ahead of order status for overlapping questions', () => {
    expect(classifyQuery('What email do I use to track my order?')).toBe('contact_email');
  });

  it.each([
    'Which products are caffeine free?',
    'How much does return shipping cost?',
    'Do you ship internationally?',
    'Can I change my shipping address?',
    'Do you use plastic-free shipping materials?',
    'Where are you today?',
    '',
  ])('leaves %j to the ordinary path', (question) => {
    expect(classifyQuery(question)).toBeNull();
  });

  it('is pure on a miss', () => {
    const deps = dependencies();
    expect(classifyQuery('Tell me about your newest product')).toBeNull();
    expect(deps.getRefundPolicy).not.toHaveBeenCalled();
    expect(deps.resolveShippingOptions).not.toHaveBeenCalled();
  });

  it('exports the ordered category contract', () => {
    expect(DETERMINISTIC_CATEGORIES).toEqual([
      'contact_email',
      'order_status',
      'business_address',
      'refund_window',
      'shipping_rates',
    ]);
  });
});

describe('resolveDeterministicAnswer', () => {
  it('uses only canonical config facts for contact, order, and address answers', async () => {
    expect(await resolveDeterministicAnswer('contact_email', facts, dependencies()))
      .toBe('You can reach Example Store support at help@example.test. Support hours are weekdays, 9–5.');
    expect(await resolveDeterministicAnswer('order_status', facts, dependencies()))
      .toContain('https://example.test/account/orders');
    expect(await resolveDeterministicAnswer('business_address', facts, dependencies()))
      .toContain('1 Example Way');
  });

  it('returns null when a config-backed value is unavailable', async () => {
    const partial = { ...facts, supportEmail: undefined, businessAddress: undefined };
    expect(await resolveDeterministicAnswer('contact_email', partial, dependencies())).toBeNull();
    expect(await resolveDeterministicAnswer('business_address', partial, dependencies())).toBeNull();
  });

  it('reads and validates the current refund window', async () => {
    const deps = dependencies({
      getRefundPolicy: vi.fn().mockResolvedValue({ returnWindowDays: 45 }),
    });
    const answer = await resolveDeterministicAnswer('refund_window', facts, deps);
    expect(answer).toContain('45 days');
    expect(answer).toContain(facts.returnsUrl);
    expect(deps.getRefundPolicy).toHaveBeenCalledOnce();
  });

  it.each([null, Number.NaN, 0, -1, 2.5])(
    'states no return-window number for malformed value %j',
    async (returnWindowDays) => {
      const answer = await resolveDeterministicAnswer('refund_window', facts, dependencies({
        getRefundPolicy: vi.fn().mockResolvedValue({ returnWindowDays }),
      }));
      expect(answer).toContain(facts.returnsUrl);
      expect(answer).not.toMatch(/\d+\s+days/i);
    },
  );

  it('states no return-window number when the settings read fails', async () => {
    const answer = await resolveDeterministicAnswer('refund_window', facts, dependencies({
      getRefundPolicy: vi.fn().mockRejectedValue(new Error('D1 unavailable')),
    }));
    expect(answer).toContain(facts.returnsUrl);
    expect(answer).not.toMatch(/\d+\s+days/i);
  });

  it('formats shipping from StoredMoney with the configured locale and currency', async () => {
    const deps = dependencies();
    const answer = await resolveDeterministicAnswer('shipping_rates', facts, deps);

    expect(answer).toContain('4,50 €');
    expect(answer).toContain('12,00 €');
    expect(answer).toContain('90,00 €');
    expect(answer).not.toMatch(/\bUS\b|United States/i);
    expect(deps.resolveShippingOptions).toHaveBeenCalledWith(0, {
      currency: 'EUR',
      subtotalPriceable: false,
    });
  });

  it('states no rate when the shipping policy read is malformed or unavailable', async () => {
    const answer = await resolveDeterministicAnswer('shipping_rates', facts, dependencies({
      resolveShippingOptions: vi.fn().mockRejectedValue(new Error('bad settings')),
    }));
    expect(answer).toContain('Checkout');
    expect(answer).not.toMatch(/[€$£]\s?\d|\d[,.]\d{2}\s?[€$£]/);
  });
});
