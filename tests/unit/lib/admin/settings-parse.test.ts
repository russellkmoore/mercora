/**
 * Admin settings parsing must be resilient to a single non-JSON row.
 *
 * The settings page used to `JSON.parse(setting.value)` unguarded in a loop over
 * every row. A single legacy row holding a bare string (currency = USD,
 * social_instagram = https://..., store_name = Acme) threw, the loop aborted,
 * and NOTHING loaded — every field kept its hardcoded default, and because the
 * page saves every category from that same state, the next Save wrote those
 * defaults over every stored setting. One un-parseable row must never cost you
 * the others.
 */
import { describe, it, expect } from 'vitest';

import { parseSettingValue, parseSettingRows } from '@/lib/admin/settings-parse';

describe('parseSettingValue', () => {
  it('parses JSON rows', () => {
    expect(parseSettingValue('1')).toBe(1);
    expect(parseSettingValue('true')).toBe(true);
    expect(parseSettingValue('"USD"')).toBe('USD');
    expect(parseSettingValue('[]')).toEqual([]);
    expect(parseSettingValue('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns a bare legacy string instead of throwing', () => {
    expect(parseSettingValue('USD')).toBe('USD');
    expect(parseSettingValue('https://instagram.com/acme')).toBe(
      'https://instagram.com/acme'
    );
    expect(parseSettingValue('Welcome to Acme')).toBe('Welcome to Acme');
    expect(parseSettingValue('/promo')).toBe('/promo');
  });

  it('treats absent values as undefined, never a throw', () => {
    expect(parseSettingValue(null)).toBeUndefined();
    expect(parseSettingValue(undefined)).toBeUndefined();
  });
});

describe('parseSettingRows', () => {
  it('keeps every good row when a legacy row sits in the middle', () => {
    const { values } = parseSettingRows([
      { key: 'system.maintenance_mode', value: 'false', category: 'system' },
      { key: 'currency', value: 'USD', category: 'store' },
      { key: 'shipping.methods', value: '[]', category: 'shipping' },
      { key: 'social_instagram', value: 'https://instagram.com/acme', category: 'social' },
      { key: 'promotions.banner_enabled', value: 'true', category: 'promotions' },
    ]);

    // The bug: everything after `currency` was lost, so these were all undefined
    // and the page saved its defaults over them.
    expect(values.get('system.maintenance_mode')).toBe(false);
    expect(values.get('shipping.methods')).toEqual([]);
    expect(values.get('promotions.banner_enabled')).toBe(true);
    expect(values.get('currency')).toBe('USD');
    expect(values.get('social_instagram')).toBe('https://instagram.com/acme');
  });

  it('reports which rows were not JSON without treating them as failures', () => {
    const { nonJsonKeys } = parseSettingRows([
      { key: 'currency', value: 'USD' },
      { key: 'shipping.methods', value: '[]' },
      { key: 'store_name', value: 'Acme' },
      // A JSON string row must NOT be reported: '"info"' is valid JSON.
      { key: 'promotions.banner_type', value: '"info"' },
    ]);

    expect(nonJsonKeys).toEqual(['currency', 'store_name']);
  });

  it('skips malformed rows rather than throwing', () => {
    const { values } = parseSettingRows([
      null,
      'not a row',
      { value: 'orphan with no key' },
      { key: 'currency', value: '"USD"' },
    ]);

    expect(values.size).toBe(1);
    expect(values.get('currency')).toBe('USD');
  });

  it('returns empty rather than throwing on a non-array payload', () => {
    expect(parseSettingRows(undefined).values.size).toBe(0);
    expect(parseSettingRows({ settings: [] }).values.size).toBe(0);
  });
});
