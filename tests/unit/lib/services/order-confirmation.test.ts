import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '@/lib/money';
import type { Order } from '@/lib/types/order';

const mocks = vi.hoisted(() => ({
  sendConfirmation: vi.fn(),
  sendMerchant: vi.fn(),
  getStoreConfig: vi.fn(),
}));

vi.mock('@/lib/utils/email', () => ({
  sendOrderConfirmationEmail: mocks.sendConfirmation,
  sendNewOrderMerchantNotification: mocks.sendMerchant,
}));
vi.mock('@/lib/store-config', () => ({ getStoreConfig: mocks.getStoreConfig }));

import {
  sendMerchantOrderNotification,
  sendOrderConfirmation,
} from '@/lib/services/order-confirmation';

function emailLessOrder(): Order {
  return {
    id: 'MCP-EMAILLESS-1',
    status: 'processing',
    payment_status: 'paid',
    total_amount: Money.fromMinor(2_500).toJSON(),
    currency_code: 'USD',
    shipping_address: {
      recipient: 'Ada Lovelace',
      line1: '1 Main Street',
      city: 'Denver',
      region: 'CO',
      postal_code: '80202',
      country: 'US',
    },
    items: [{
      id: 'line-1',
      product_id: '',
      variant_id: 'variant-1',
      sku: 'SKU-1',
      product_name: 'Product',
      quantity: 1,
      unit_price: Money.fromMinor(2_500).toJSON(),
      total_price: Money.fromMinor(2_500).toJSON(),
    }],
    extensions: {},
  };
}

function giftCardOnlyOrder(): Order {
  return {
    id: 'MCP-GIFTCARD-1',
    status: 'processing',
    payment_status: 'paid',
    total_amount: Money.fromMinor(2_500).toJSON(),
    currency_code: 'USD',
    billing_address: {
      recipient: 'Ada Lovelace',
      line1: '1 Main Street',
      city: 'Austin',
      region: 'TX',
      postal_code: '73301',
      country: 'US',
    },
    items: [{
      id: 'line-1',
      product_id: '',
      variant_id: 'variant-1',
      sku: 'SKU-1',
      product_name: 'Gift Card',
      quantity: 1,
      unit_price: Money.fromMinor(2_500).toJSON(),
      total_price: Money.fromMinor(2_500).toJSON(),
      fulfillment_type: 'digital',
      gift_card: { recipientEmail: 'recipient@example.test' },
    }],
    extensions: { email: 'buyer@example.test' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStoreConfig.mockReturnValue({
    contact: { merchantNotificationEmail: 'fulfillment@example.test' },
  });
  mocks.sendMerchant.mockResolvedValue({ success: true, id: 'merchant-1' });
});

describe('merchant order effect payload', () => {
  it('sends an email-less web or MCP order when a merchant recipient is configured', async () => {
    const order = emailLessOrder();
    await expect(sendMerchantOrderNotification(order, 'merchant/MCP-EMAILLESS-1/v1'))
      .resolves.toMatchObject({ success: true, id: 'merchant-1' });
    expect(mocks.sendMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'MCP-EMAILLESS-1',
        items: expect.arrayContaining([expect.objectContaining({ name: 'Product' })]),
        shippingAddress: expect.objectContaining({ city: 'Denver' }),
      }),
      { idempotencyKey: 'merchant/MCP-EMAILLESS-1/v1' },
    );
    expect(mocks.sendMerchant.mock.calls[0][0]).not.toHaveProperty('customerEmail');
  });

  it('fails invalid fulfillment data instead of reporting a successful skip', async () => {
    const order = emailLessOrder();
    order.shipping_address = undefined;
    await expect(sendMerchantOrderNotification(order, 'merchant/MCP-EMAILLESS-1/v1'))
      .resolves.toMatchObject({ success: false, errorCode: 'E_MERCHANT_PAYLOAD' });
    expect(mocks.sendMerchant).not.toHaveBeenCalled();
  });

  it('delivers addressless digital renewal payloads to customer and merchant', async () => {
    mocks.sendConfirmation.mockResolvedValue({ success: true, id: 'customer-digital' });
    const order = emailLessOrder();
    order.shipping_address = undefined;
    order.extensions = {
      email: 'digital@example.test',
      customer_name: 'Digital Customer',
      subscription_shipping_required: false,
    };

    await expect(sendOrderConfirmation(order, 'confirmation/digital/v1'))
      .resolves.toMatchObject({ success: true, id: 'customer-digital' });
    await expect(sendMerchantOrderNotification(order, 'merchant/digital/v1'))
      .resolves.toMatchObject({ success: true, id: 'merchant-1' });
    expect(mocks.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'digital@example.test',
        customerName: 'Digital Customer',
      }),
      { idempotencyKey: 'confirmation/digital/v1' },
    );
    expect(mocks.sendConfirmation.mock.calls.at(-1)?.[0]).not.toHaveProperty('shippingAddress');
    expect(mocks.sendMerchant).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: 'merchant/digital/v1',
    });
    expect(mocks.sendMerchant.mock.calls.at(-1)?.[0]).not.toHaveProperty('shippingAddress');
  });

  it('sends a gift-card-only order confirmation with the billing address and label', async () => {
    mocks.sendConfirmation.mockResolvedValue({ success: true, id: 'customer-giftcard' });
    const order = giftCardOnlyOrder();

    await expect(sendOrderConfirmation(order, 'confirmation/giftcard/v1'))
      .resolves.toMatchObject({ success: true, id: 'customer-giftcard' });
    expect(mocks.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'buyer@example.test',
        shippingAddress: expect.objectContaining({ city: 'Austin' }),
        addressLabel: 'billing',
      }),
      { idempotencyKey: 'confirmation/giftcard/v1' },
    );
  });

  it('sends the merchant notification for the same gift-card-only order', async () => {
    const order = giftCardOnlyOrder();

    await expect(sendMerchantOrderNotification(order, 'merchant/giftcard/v1'))
      .resolves.toMatchObject({ success: true, id: 'merchant-1' });
    expect(mocks.sendMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingAddress: expect.objectContaining({ city: 'Austin' }),
        addressLabel: 'billing',
      }),
      { idempotencyKey: 'merchant/giftcard/v1' },
    );
  });

  it('reports a skip only when the merchant recipient is absent', async () => {
    mocks.getStoreConfig.mockReturnValue({ contact: {} });
    const invalid = emailLessOrder();
    invalid.shipping_address = undefined;

    await expect(sendMerchantOrderNotification(invalid, 'merchant/MCP-EMAILLESS-1/v1'))
      .resolves.toEqual({ success: true, skipped: true });
    expect(mocks.sendMerchant).not.toHaveBeenCalled();
  });
});

describe('supplied tokens override (Plan 04, D-10)', () => {
  const suppliedTokens = { primary: '#ff00ff' } as never;

  it('forwards a supplied token set to the confirmation sender', async () => {
    mocks.sendConfirmation.mockResolvedValue({ success: true, id: 'customer-1' });
    const order = emailLessOrder();
    order.extensions = { email: 'buyer@example.test' };

    await sendOrderConfirmation(order, 'confirmation/MCP-EMAILLESS-1/v1', suppliedTokens);

    expect(mocks.sendConfirmation).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: 'confirmation/MCP-EMAILLESS-1/v1', tokens: suppliedTokens },
    );
  });

  it('forwards a supplied token set to the merchant-notification sender', async () => {
    const order = emailLessOrder();

    await sendMerchantOrderNotification(order, 'merchant/MCP-EMAILLESS-1/v1', suppliedTokens);

    expect(mocks.sendMerchant).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: 'merchant/MCP-EMAILLESS-1/v1', tokens: suppliedTokens },
    );
  });

  it('resolves no token set itself when one is supplied (no tokens key when omitted)', async () => {
    mocks.sendConfirmation.mockResolvedValue({ success: true, id: 'customer-2' });
    const order = emailLessOrder();
    order.extensions = { email: 'buyer@example.test' };

    await sendOrderConfirmation(order, 'confirmation/MCP-EMAILLESS-1/v1');

    const [, options] = mocks.sendConfirmation.mock.calls.at(-1) as [unknown, { tokens?: unknown }];
    expect(options.tokens).toBeUndefined();
  });
});
