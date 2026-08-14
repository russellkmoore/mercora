import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  record: {} as any,
  retrievePaymentIntent: vi.fn(),
  promoteOrderToPaid: vi.fn(),
  recordCouponReconciliation: vi.fn(),
  redeemCoupon: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
  stagePaidOrderEffects: vi.fn(),
  drainOrderEffects: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [mocks.record] }),
      }),
    }),
  })),
}));
vi.mock('@/lib/stripe', () => ({ retrievePaymentIntent: mocks.retrievePaymentIntent }));
vi.mock('@/lib/models/mach/couponInstance', () => ({ redeemCoupon: mocks.redeemCoupon }));
vi.mock('@/lib/utils/email', () => ({ sendOrderConfirmationEmail: mocks.sendOrderConfirmationEmail }));
vi.mock('@/lib/services/order-effects', () => ({
  stagePaidOrderEffects: mocks.stagePaidOrderEffects,
  drainOrderEffects: mocks.drainOrderEffects,
}));
vi.mock('@/lib/models/mach/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/models/mach/orders')>();
  return {
    ...actual,
    promoteOrderToPaid: mocks.promoteOrderToPaid,
    recordCouponReconciliation: mocks.recordCouponReconciliation,
  };
});

import {
  finalizeOrderPayment,
  PaymentVerificationError,
} from '@/lib/services/order-finalization';

function orderRecord() {
  return {
    id: 'WEB-USER-1-AAAA',
    customer_id: 'user_1',
    status: 'pending',
    total_amount: { amount: 2_500, currency: 'USD' },
    currency_code: 'USD',
    shipping_address: { line1: '1 Main', city: 'Denver', country: 'US', email: 'a@example.com' },
    billing_address: null,
    items: [{
      product_id: 'p1', variant_id: 'v1', sku: 'S1', quantity: 1,
      unit_price: { amount: 2_000, currency: 'USD' },
      total_price: { amount: 2_000, currency: 'USD' }, product_name: 'Catalog',
    }],
    shipping_method: 'Standard',
    payment_method: 'stripe',
    payment_status: 'pending',
    notes: null,
    external_references: { payment_intent_id: 'pi_bound' },
    extensions: {
      payment_intent_id: 'pi_bound',
      checkout_subtotal: { amount: 2_000, currency: 'USD' },
      checkout_shipping: { amount: 300, currency: 'USD' },
      checkout_tax: { amount: 200, currency: 'USD' },
      checkout_tender: { amount: 0, currency: 'USD' },
      checkout_discount: { amount: 100, currency: 'USD' },
      checkout_total: { amount: 2_500, currency: 'USD' },
      discount_codes: ['SAVE'],
    },
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
    shipped_at: null,
    delivered_at: null,
    tracking_number: null,
  };
}

beforeEach(() => {
  mocks.record = orderRecord();
  mocks.retrievePaymentIntent.mockResolvedValue({
    id: 'pi_bound',
    status: 'succeeded',
    amount: 2_500,
    amount_received: 2_500,
    currency: 'usd',
    metadata: { orderId: 'WEB-USER-1-AAAA' },
  });
  mocks.promoteOrderToPaid.mockResolvedValue({
    promoted: true,
    order: {
      id: 'WEB-USER-1-AAAA', customer_id: 'user_1', status: 'processing',
      total_amount: { amount: 2_500, currency: 'USD' }, currency_code: 'USD',
      shipping_address: mocks.record.shipping_address,
      items: [], payment_status: 'paid', extensions: { ...mocks.record.extensions, email: 'a@example.com' },
    },
  });
  mocks.redeemCoupon.mockResolvedValue({ redeemed: true });
  mocks.recordCouponReconciliation.mockResolvedValue(undefined);
  mocks.sendOrderConfirmationEmail.mockResolvedValue({ success: true });
  mocks.stagePaidOrderEffects.mockResolvedValue(undefined);
  mocks.drainOrderEffects.mockResolvedValue({ claimed: 5, succeeded: 4, failed: 1 });
});

describe('verified paid-order finalization', () => {
  it.each([
    ['requires_action', 'usd', 2_500, 'WEB-USER-1-AAAA'],
    ['succeeded', 'eur', 2_500, 'WEB-USER-1-AAAA'],
    ['succeeded', 'usd', 2_499, 'WEB-USER-1-AAAA'],
    ['succeeded', 'usd', 2_500, 'WEB-OTHER-1-BBBB'],
  ])('rejects unverified PI state %#', async (status, currency, received, metadataOrderId) => {
    mocks.retrievePaymentIntent.mockResolvedValue({
      id: 'pi_bound', status, amount: 2_500, amount_received: received, currency,
      metadata: { orderId: metadataOrderId },
    });
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      customerId: 'user_1',
      enforceOwnership: true,
    })).rejects.toBeInstanceOf(PaymentVerificationError);
    expect(mocks.promoteOrderToPaid).not.toHaveBeenCalled();
  });

  it('rejects owner mismatch and immutable PI-column mismatch', async () => {
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      customerId: 'attacker',
      enforceOwnership: true,
    })).rejects.toBeInstanceOf(PaymentVerificationError);

    mocks.record.external_references = { payment_intent_id: 'pi_other' };
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).rejects.toBeInstanceOf(PaymentVerificationError);
  });

  it('requires the authorized PI amount to equal the immutable server quote', async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({
      id: 'pi_bound', status: 'succeeded', amount: 2_499, amount_received: 2_500,
      currency: 'usd', metadata: { orderId: mocks.record.id },
    });
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).rejects.toBeInstanceOf(PaymentVerificationError);
    expect(mocks.promoteOrderToPaid).not.toHaveBeenCalled();
  });

  it('stages before promotion and drains for winner and already-paid convergence', async () => {
    const first = await finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      customerId: 'user_1',
      enforceOwnership: true,
    });
    expect(first.promoted).toBe(true);
    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
    const promotionArgs = mocks.promoteOrderToPaid.mock.calls[0][0];
    expect(promotionArgs.orderId).toBe(mocks.record.id);
    expect(promotionArgs.amountReceived.toJSON()).toEqual({ amount: 2_500, currency: 'USD' });
    expect(mocks.stagePaidOrderEffects).toHaveBeenCalledTimes(2);
    expect(mocks.stagePaidOrderEffects.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.promoteOrderToPaid.mock.invocationCallOrder[0]);
    expect(mocks.drainOrderEffects).toHaveBeenCalledWith(expect.objectContaining({
      orderId: mocks.record.id,
      limit: 25,
    }));

    mocks.promoteOrderToPaid.mockResolvedValue({
      promoted: false,
      order: { ...first.order, payment_status: 'paid' },
    });
    await finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      customerId: 'user_1',
      enforceOwnership: true,
    });
    expect(mocks.stagePaidOrderEffects).toHaveBeenCalledTimes(4);
    expect(mocks.drainOrderEffects).toHaveBeenCalledTimes(2);
  });

  it('repairs deterministic rows after paid promotion before inline draining', async () => {
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: true });

    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
    expect(mocks.promoteOrderToPaid.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.stagePaidOrderEffects.mock.invocationCallOrder[1]);
    expect(mocks.stagePaidOrderEffects.mock.invocationCallOrder[1])
      .toBeLessThan(mocks.drainOrderEffects.mock.invocationCallOrder[0]);
  });

  it('blocks paid promotion when pre-CAS effect staging fails', async () => {
    mocks.stagePaidOrderEffects.mockRejectedValueOnce(new Error('effect staging unavailable'));

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).rejects.toThrow('effect staging unavailable');

    expect(mocks.promoteOrderToPaid).not.toHaveBeenCalled();
    expect(mocks.drainOrderEffects).not.toHaveBeenCalled();
  });

  it('does not consume coupons unless promotion proves the order is paid', async () => {
    mocks.promoteOrderToPaid.mockResolvedValue({
      promoted: false,
      order: { ...mocks.record, status: 'cancelled', payment_status: 'failed' },
    });

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).rejects.toThrow('without a paid winner');

    expect(mocks.drainOrderEffects).not.toHaveBeenCalled();
  });

  it('allows recovery when coupon audit proves the order already redeemed it', async () => {
    mocks.redeemCoupon.mockResolvedValue({ redeemed: false, alreadyRedeemed: true });

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: true });

    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
  });

  it('re-verifies the immutable quote after final total records a larger captured receipt', async () => {
    mocks.record.payment_status = 'paid';
    mocks.record.status = 'processing';
    mocks.record.total_amount = { amount: 2_600, currency: 'USD' };
    mocks.retrievePaymentIntent.mockResolvedValue({
      id: 'pi_bound', status: 'succeeded', amount: 2_500, amount_received: 2_600,
      currency: 'usd', metadata: { orderId: mocks.record.id },
    });
    mocks.redeemCoupon.mockResolvedValue({ redeemed: false, alreadyRedeemed: true });
    mocks.promoteOrderToPaid.mockResolvedValue({
      promoted: false,
      order: { ...mocks.record, payment_status: 'paid' },
    });

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: false });
  });

  it('passes idempotent capabilities to each drain without re-verifying paid tender', async () => {
    const verifyReservedTender = vi.fn(async () => undefined);
    const applyTender = vi.fn(async () => undefined);
    const orderPaid = vi.fn(async () => undefined);
    const capabilities = {
      giftCards: { resolveTender: vi.fn(), verifyReservedTender, applyTender },
      subscriptions: { validateCheckout: vi.fn(), orderPaid },
    };

    const first = await finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      capabilities,
    });
    mocks.record.payment_status = 'paid';
    mocks.record.status = 'processing';
    mocks.promoteOrderToPaid.mockResolvedValue({
      promoted: false,
      order: { ...first.order, payment_status: 'paid' },
    });
    await finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      capabilities,
    });

    expect(verifyReservedTender).toHaveBeenCalledTimes(1);
    expect(mocks.drainOrderEffects).toHaveBeenCalledTimes(2);
    expect(mocks.drainOrderEffects).toHaveBeenNthCalledWith(1, expect.objectContaining({ capabilities }));
    expect(mocks.drainOrderEffects).toHaveBeenNthCalledWith(2, expect.objectContaining({ capabilities }));
  });

  it('acknowledges paid durability when an inline effect is queued for retry', async () => {
    const capabilities = {
      giftCards: {
        resolveTender: vi.fn(),
        verifyReservedTender: vi.fn(async () => undefined),
        applyTender: vi.fn(async () => { throw new Error('tender store unavailable'); }),
      },
      subscriptions: { validateCheckout: vi.fn(), orderPaid: vi.fn() },
    };

    mocks.drainOrderEffects.mockResolvedValue({ claimed: 5, succeeded: 4, failed: 1 });
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      capabilities,
    })).resolves.toMatchObject({ paid: true, promoted: true });

    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
    expect(mocks.drainOrderEffects).toHaveBeenCalledWith(expect.objectContaining({ capabilities }));
  });

  it('acknowledges paid state when inline drain infrastructure defers to scheduled recovery', async () => {
    const capabilities = {
      giftCards: {
        resolveTender: vi.fn(),
        verifyReservedTender: vi.fn(async () => undefined),
        applyTender: vi.fn(async () => undefined),
      },
      subscriptions: {
        validateCheckout: vi.fn(),
        orderPaid: vi.fn(async () => { throw new Error('subscription store unavailable'); }),
      },
    };

    const error = new Error('effect claim unavailable');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.drainOrderEffects.mockRejectedValue(error);
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      capabilities,
    })).resolves.toMatchObject({ paid: true, promoted: true });

    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
    const alert = JSON.parse(String(errorLog.mock.calls[0][0]));
    expect(alert).toMatchObject({
      marker: 'commerce.telemetry.v1',
      event: 'paid_effect.drain_failed',
      severity: 'critical',
      fields: { operation: 'process', outcome: 'failed', retryable: true },
      error_class: 'Error',
    });
    expect(JSON.stringify(alert)).not.toContain(mocks.record.id);
    expect(JSON.stringify(alert)).not.toContain(error.message);
    errorLog.mockRestore();
  });

  it('verifies non-cash tender before paid promotion', async () => {
    mocks.record.extensions.checkout_tender = { amount: 500, currency: 'USD' };
    const capabilities = {
      giftCards: {
        resolveTender: vi.fn(),
        verifyReservedTender: vi.fn(async () => { throw new Error('reservation expired'); }),
        applyTender: vi.fn(),
      },
      subscriptions: { validateCheckout: vi.fn(), orderPaid: vi.fn() },
    };
    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      capabilities,
    })).rejects.toThrow('reservation expired');
    expect(mocks.promoteOrderToPaid).not.toHaveBeenCalled();
  });

  it('does not report failure after paid CAS when confirmation email fails', async () => {
    mocks.drainOrderEffects.mockResolvedValue({ claimed: 5, succeeded: 4, failed: 1 });

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: true });
  });
});
