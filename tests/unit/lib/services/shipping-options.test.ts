import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/settings', () => ({ getSettings: vi.fn() }));

import { resolveShippingOptions } from '@/lib/services/shipping-options';
import { getSettings } from '@/lib/utils/settings';

function withSettings(
  shipping: Record<string, unknown>,
  store: Record<string, unknown> = {},
) {
  vi.mocked(getSettings).mockImplementation(async (category?: string) =>
    category === 'shipping' ? shipping : store,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  withSettings({});
});

describe('resolveShippingOptions', () => {
  it('returns default prices as StoredMoney while preserving major-unit settings semantics', async () => {
    const result = await resolveShippingOptions(0, { currency: 'USD' });

    expect(result.options).toEqual([
      { id: 'standard', label: 'Standard (5–7 days)', cost: { amount: 599, currency: 'USD' }, estimatedDays: 5 },
      { id: 'express', label: 'Express (2–3 days)', cost: { amount: 999, currency: 'USD' }, estimatedDays: 2 },
      { id: 'overnight', label: 'Overnight', cost: { amount: 1999, currency: 'USD' }, estimatedDays: 1 },
    ]);
    expect(result.freeShippingThresholdMajor).toBe(75);
    expect(result.freeMethodIds).toEqual(['standard']);
    expect(getSettings).toHaveBeenCalledWith('shipping');
    expect(getSettings).toHaveBeenCalledWith('store');
  });

  it('applies the configured threshold only to configured free methods', async () => {
    withSettings(
      {
        'shipping.methods': [
          { id: 'ground', label: 'Ground', cost: 4.5, estimatedDays: 6, enabled: true },
          { id: 'air', label: 'Air', cost: 12, estimatedDays: 2, enabled: true },
        ],
        'shipping.free_methods': ['ground'],
      },
      { 'store.free_shipping_threshold': '90' },
    );

    const below = await resolveShippingOptions(8_999, { currency: 'EUR' });
    const at = await resolveShippingOptions(9_000, { currency: 'EUR' });

    expect(below.qualifiesForFreeShipping).toBe(false);
    expect(below.options[0].cost).toEqual({ amount: 450, currency: 'EUR' });
    expect(at.qualifiesForFreeShipping).toBe(true);
    expect(at.options[0].cost).toEqual({ amount: 0, currency: 'EUR' });
    expect(at.options[1].cost).toEqual({ amount: 1200, currency: 'EUR' });
  });

  it('fails the perk closed when the subtotal is not authoritative', async () => {
    const result = await resolveShippingOptions(100_000, {
      subtotalPriceable: false,
    });

    expect(result.qualifiesForFreeShipping).toBe(false);
    expect(result.options[0].cost.amount).toBe(599);
  });

  it('treats a configured zero threshold as free for every eligible order', async () => {
    withSettings({}, { 'store.free_shipping_threshold': 0 });
    const result = await resolveShippingOptions(0, { currency: 'USD' });

    expect(result.qualifiesForFreeShipping).toBe(true);
    expect(result.options[0].cost).toEqual({ amount: 0, currency: 'USD' });
    expect(result.options[1].cost).toEqual({ amount: 999, currency: 'USD' });
  });

  it.each([null, '', ' ', false, [], 'not-a-number', -1])(
    'rejects an explicit malformed threshold (%j) instead of quoting a default',
    async (threshold) => {
      withSettings({}, { 'store.free_shipping_threshold': threshold });
      await expect(resolveShippingOptions(0)).rejects.toThrow(/threshold/i);
    },
  );

  it.each([undefined, null, '', ' ', false, [], 'nope', -1])(
    'rejects a malformed method cost (%j) instead of presenting it as free',
    async (cost) => {
      withSettings({
        'shipping.methods': [
          { id: 'broken', label: 'Broken', cost, estimatedDays: 3, enabled: true },
        ],
      });
      await expect(resolveShippingOptions(0)).rejects.toThrow(/method/i);
    },
  );

  it('bounds the configured method collection', async () => {
    withSettings({
      'shipping.methods': Array.from({ length: 21 }, (_, index) => ({
        id: `method-${index}`,
        label: `Method ${index}`,
        cost: 1,
        estimatedDays: 1,
        enabled: true,
      })),
    });

    await expect(resolveShippingOptions(0)).rejects.toThrow(/too many/i);
  });
});
