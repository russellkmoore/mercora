import { describe, expect, it } from 'vitest';
import {
  canFulfillInventory,
  isInventoryAvailable,
  isVariantAvailable,
} from '@/lib/inventory/availability';

// CAT-04: the Voltique Gift Card's four variants are seeded with the exact
// inventory shape `{"track_inventory": false}` — no `quantity` key at all
// (data/d1/seed.sql gift-card block, plan 09-01). This file pins that a
// widened or narrowed `isInventoryAvailable`/`isVariantAvailable` cannot
// silently make those denominations read as out of stock.
describe('untracked gift-card inventory shape', () => {
  const untrackedInventory = { track_inventory: false as const };

  it('treats the seeded untracked-inventory object as available with no quantity key present', () => {
    expect(isInventoryAvailable(untrackedInventory)).toBe(true);
  });

  it('treats undefined and null inventory as available', () => {
    expect(isInventoryAvailable(undefined)).toBe(true);
    expect(isInventoryAvailable(null)).toBe(true);
  });

  it('reads an active gift-card variant carrying the seeded shape as available', () => {
    expect(isVariantAvailable({ status: 'active', inventory: untrackedInventory })).toBe(true);
  });

  it('reads an inactive gift-card variant carrying the seeded shape as unavailable', () => {
    expect(isVariantAvailable({ status: 'inactive', inventory: untrackedInventory })).toBe(false);
  });

  it('reads a gift-card variant with a null or absent status as available', () => {
    expect(isVariantAvailable({
      status: null,
      inventory: untrackedInventory,
    } as unknown as Parameters<typeof isVariantAvailable>[0])).toBe(true);
    expect(isVariantAvailable({ inventory: untrackedInventory })).toBe(true);
  });

  it('can fulfill any positive integer quantity against the untracked shape, but not zero or a fraction', () => {
    expect(canFulfillInventory(untrackedInventory, 1)).toBe(true);
    expect(canFulfillInventory(untrackedInventory, 9_007_199_254_740_991)).toBe(true);
    expect(canFulfillInventory(untrackedInventory, 0)).toBe(false);
    expect(canFulfillInventory(untrackedInventory, 1.5)).toBe(false);
  });
});
