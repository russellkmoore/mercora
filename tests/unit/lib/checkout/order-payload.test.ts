import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingCheckout,
  loadPendingCheckout,
  savePendingCheckout,
} from '@/lib/checkout/order-payload';

afterEach(() => vi.unstubAllGlobals());

describe('pending checkout browser snapshot', () => {
  it('never throws when browser storage is denied or over quota', () => {
    vi.stubGlobal('window', {
      localStorage: {
        setItem: () => { throw new Error('quota'); },
        getItem: () => { throw new Error('denied'); },
        removeItem: () => { throw new Error('denied'); },
      },
    });

    expect(() => savePendingCheckout({ orderId: 'WEB-1', paymentIntentId: 'pi_1' })).not.toThrow();
    expect(loadPendingCheckout('pi_1')).toBeNull();
    expect(() => clearPendingCheckout('pi_1')).not.toThrow();
  });
});
