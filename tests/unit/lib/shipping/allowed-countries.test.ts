import { describe, expect, it } from 'vitest';
import {
  allowedShippingCountries,
  enabledShippingMethods,
  freeShippingThreshold,
} from '@/lib/shipping/allowed-countries';

describe('shipping configuration policy', () => {
  it('fails malformed or missing country configuration back to US', () => {
    expect(allowedShippingCountries({})).toEqual(['US']);
    expect(allowedShippingCountries({ 'shipping.allowed_countries': ['USA'] })).toEqual(['US']);
  });

  it('normalizes configured countries and includes methods unless explicitly disabled', () => {
    expect(allowedShippingCountries({ 'shipping.allowed_countries': ['ca', 'US'] }))
      .toEqual(['CA', 'US']);
    expect(enabledShippingMethods({
      'shipping.methods': [
        { id: 'implicit' },
        { id: 'enabled', enabled: true },
        { id: 'disabled', enabled: false },
      ],
    }).map((method) => method.id)).toEqual(['implicit', 'enabled']);
  });

  it('provides enabled fresh-install methods', () => {
    expect(enabledShippingMethods({}).map((method) => method.id))
      .toEqual(['standard', 'express', 'overnight']);
  });

  it.each([null, '', '   ', false, [], {}, 'not-a-number'])(
    'does not coerce malformed threshold %j to free shipping',
    (value) => {
      expect(freeShippingThreshold({ 'store.free_shipping_threshold': value })).toBe(75);
    },
  );

  it('accepts valid numeric and numeric-string thresholds, including zero', () => {
    expect(freeShippingThreshold({ 'store.free_shipping_threshold': 0 })).toBe(0);
    expect(freeShippingThreshold({ 'store.free_shipping_threshold': '90' })).toBe(90);
  });
});
