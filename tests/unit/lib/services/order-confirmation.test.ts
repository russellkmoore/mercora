import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '@/lib/money';
import type { Order } from '@/lib/types/order';

const mocks = vi.hoisted(() => ({
  sendConfirmation: vi.fn(),
  sendMerchant: vi.fn(),
}));

vi.mock('@/lib/utils/email', () => ({
  sendOrderConfirmationEmail: mocks.sendConfirmation,
  sendNewOrderMerchantNotification: mocks.sendMerchant,
}));

import { sendMerchantOrderNotification } from '@/lib/services/order-confirmation';

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

beforeEach(() => {
  vi.clearAllMocks();
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
});
