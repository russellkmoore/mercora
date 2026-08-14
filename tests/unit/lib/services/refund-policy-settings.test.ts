import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ key: string; value: string }>,
}));

vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: async () => mocks.rows,
      }),
    }),
  })),
}));

import { getRefundPolicy } from '@/lib/utils/settings';

beforeEach(() => {
  mocks.rows = [];
});

describe('getRefundPolicy return-window projection', () => {
  it.each([
    ['JSON number', '45', 45],
    ['JSON numeric string', '"60"', 60],
  ])('projects a valid %s', async (_label, value, expected) => {
    mocks.rows = [{ key: 'refund.return_window_days', value }];
    expect((await getRefundPolicy()).returnWindowDays).toBe(expected);
  });

  it.each([
    ['missing', undefined],
    ['null', 'null'],
    ['blank', '"   "'],
    ['boolean', 'false'],
    ['fractional', '2.5'],
    ['zero', '0'],
    ['negative', '-3'],
    ['non-numeric', '"soon"'],
  ])('keeps a %s return window unavailable', async (_label, value) => {
    mocks.rows = value === undefined
      ? []
      : [{ key: 'refund.return_window_days', value }];
    expect((await getRefundPolicy()).returnWindowDays).toBeNull();
  });
});
