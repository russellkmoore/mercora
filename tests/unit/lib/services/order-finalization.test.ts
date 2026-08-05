import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  record: {} as any,
  retrievePaymentIntent: vi.fn(),
  promoteOrderToPaid: vi.fn(),
  redeemCoupon: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
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
vi.mock('@/lib/models/mach/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/models/mach/orders')>();
  return { ...actual, promoteOrderToPaid: mocks.promoteOrderToPaid };
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
  mocks.sendOrderConfirmationEmail.mockResolvedValue({ success: true });
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

  it('runs paid effects only for the CAS winner', async () => {
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
    expect(mocks.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.redeemCoupon).toHaveBeenCalledTimes(1);

    mocks.promoteOrderToPaid.mockResolvedValue({
      promoted: false,
      order: { ...first.order, payment_status: 'paid' },
    });
    mocks.redeemCoupon.mockResolvedValue({ redeemed: false, alreadyRedeemed: true });
    await finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
      customerId: 'user_1',
      enforceOwnership: true,
    });
    expect(mocks.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.redeemCoupon).toHaveBeenCalledTimes(2);
  });

  it('promotes captured money when a coupon race requires reconciliation', async () => {
    mocks.redeemCoupon.mockResolvedValue({ redeemed: false, alreadyRedeemed: false });

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: true });

    expect(mocks.promoteOrderToPaid).toHaveBeenCalledOnce();
  });

  it('propagates transient coupon persistence errors before paid promotion', async () => {
    mocks.redeemCoupon.mockRejectedValue(new Error('D1 unavailable'));

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).rejects.toThrow('D1 unavailable');

    expect(mocks.promoteOrderToPaid).not.toHaveBeenCalled();
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
    mocks.sendOrderConfirmationEmail.mockRejectedValue(new Error('email unavailable'));

    await expect(finalizeOrderPayment({
      orderId: mocks.record.id,
      paymentIntentId: 'pi_bound',
    })).resolves.toMatchObject({ paid: true, promoted: true });
  });
});
