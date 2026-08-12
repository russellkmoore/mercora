import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), getStoreConfig: vi.fn() }));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.send }));
vi.mock('@/lib/store-config', () => ({ getStoreConfig: mocks.getStoreConfig }));

import { sendNewOrderMerchantNotification, type MerchantOrderData, type OrderData } from '@/lib/utils/email';

const order: OrderData = {
  orderNumber: 'ORD 1/2?x=1',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.test',
  items: [{
    productId: 'product-1', name: '<Useful Product>', quantity: 2,
    price: { amount: 1_250, currency: 'USD' },
  }],
  subtotal: { amount: 2_500, currency: 'USD' },
  shipping: { amount: 500, currency: 'USD' },
  tax: { amount: 100, currency: 'USD' },
  total: { amount: 3_100, currency: 'USD' },
  shippingAddress: {
    street: '1 Main Street', city: 'Denver', state: 'CO', zipCode: '80202', country: 'US',
  },
};

function config(recipient?: string) {
  return {
    identity: { name: 'Example Store' },
    contact: {
      senderEmail: 'Example Store <orders@example.test>',
      supportEmail: 'help@example.test',
      postalAddress: '1 Example Street',
      merchantNotificationEmail: recipient,
    },
    urls: { site: 'https://shop.example.test' },
  };
}

beforeEach(() => {
  mocks.send.mockResolvedValue({ success: true, id: 'email-1', provider: 'cloudflare' });
  mocks.getStoreConfig.mockReturnValue(config('fulfillment@example.test'));
});

describe('merchant new-order notification', () => {
  it('deep-links to the encoded order and uses the shared provider boundary', async () => {
    await expect(sendNewOrderMerchantNotification(order, {
      idempotencyKey: 'merchant-notification/ORD-1/v1',
    })).resolves.toMatchObject({ success: true, id: 'email-1' });

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: ['fulfillment@example.test'],
      replyTo: 'ada@example.test',
      html: expect.stringContaining('/admin/orders/ORD%201%2F2%3Fx%3D1'),
      text: expect.stringContaining('/admin/orders/ORD%201%2F2%3Fx%3D1'),
    }), { idempotencyKey: 'merchant-notification/ORD-1/v1' });
    expect(mocks.send.mock.calls[0][0].html).toContain('&lt;Useful Product&gt;');
  });

  it('is a successful no-op when no merchant recipient is configured', async () => {
    mocks.getStoreConfig.mockReturnValue(config());
    await expect(sendNewOrderMerchantNotification(order)).resolves.toEqual({
      success: true,
      skipped: true,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sends fulfillment details without requiring a customer email or reply-to', async () => {
    const emailLess: MerchantOrderData = { ...order, customerEmail: undefined };
    await expect(sendNewOrderMerchantNotification(emailLess)).resolves.toMatchObject({ success: true });

    const message = mocks.send.mock.calls[0][0];
    expect(message).not.toHaveProperty('replyTo');
    expect(message.text).not.toContain('Customer email:');
    expect(message.html).toContain('Items to ship');
  });
});
