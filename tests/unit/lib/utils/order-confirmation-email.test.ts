import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.send }));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: 'Test Store', tagline: 'Test commerce' },
    contact: { senderEmail: 'Test Store <orders@example.com>', supportEmail: 'help@example.com' },
    urls: { site: 'https://store.example.com', imageCdn: 'https://images.example.com' },
    deployment: { imageTransformsEnabled: true },
  }),
}));

import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '@/lib/utils/email';

const orderData = {
  orderNumber: 'WEB-EMAIL-1',
  customerName: 'Customer',
  customerEmail: 'customer@example.com',
  items: [{
    productId: 'product-1',
    name: 'Product',
    price: { amount: 1_000, currency: 'USD' },
    quantity: 1,
    imageUrl: '/catalog/product.jpg',
  }],
  subtotal: { amount: 1_000, currency: 'USD' },
  shipping: { amount: 0, currency: 'USD' },
  tax: { amount: 100, currency: 'USD' },
  total: { amount: 1_100, currency: 'USD' },
  shippingAddress: {
    street: '1 Main', city: 'Denver', state: 'CO', zipCode: '80202', country: 'US',
  },
};

beforeEach(() => {
  mocks.send.mockResolvedValue({ success: true, id: 'email-provider-1', provider: 'resend' });
});

describe('order confirmation provider boundary', () => {
  it('uses generic runtime configuration and forwards the deterministic provider key', async () => {
    await expect(sendOrderConfirmationEmail(orderData, {
      idempotencyKey: 'order-confirmation/WEB-EMAIL-1/v1',
    })).resolves.toEqual({ success: true, id: 'email-provider-1', provider: 'resend' });

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Test Store <orders@example.com>',
      to: ['customer@example.com'],
      subject: 'Order Confirmation #WEB-EMAIL-1 - Test Store',
    }), { idempotencyKey: 'order-confirmation/WEB-EMAIL-1/v1' });
    const html = mocks.send.mock.calls[0][0].html as string;
    expect(html).toContain('Test Store');
    expect(html).toContain('Test commerce');
    expect(html).toContain('https://images.example.com/cdn-cgi/image/width=100,quality=80,format=auto/catalog/product.jpg');
    expect(html).not.toContain('Voltique');
  });

  it('returns success false when the provider rejects the attempt', async () => {
    mocks.send.mockResolvedValue({ success: false, error: 'provider rejected' });

    await expect(sendOrderConfirmationEmail(orderData, {
      idempotencyKey: 'order-confirmation/WEB-EMAIL-1/v1',
    })).resolves.toEqual({ success: false, error: 'provider rejected' });
  });
});

describe('order status provider boundary', () => {
  it('escapes persisted customer content and rejects unsafe tracking links', async () => {
    await sendOrderStatusUpdateEmail({
      orderNumber: '<order>',
      customerName: '<Customer>',
      customerEmail: 'customer@example.com',
      status: 'shipped',
      carrier: '<Carrier>',
      trackingNumber: '<tracking>',
      trackingUrl: 'javascript:alert(1)',
      notes: '<note>',
      items: [{
        productId: 'product-1', name: '<Product>', price: { amount: 100, currency: 'USD' }, quantity: 1,
      }],
      shippingAddress: {
        street: '<street>', city: '<city>', state: '<state>', zipCode: '<zip>', country: '<country>',
      },
    });

    const html = mocks.send.mock.calls.at(-1)?.[0].html as string;
    expect(html).toContain('&lt;Customer&gt;');
    expect(html).toContain('&lt;Product&gt;');
    expect(html).toContain('&lt;street&gt;');
    expect(html).not.toContain('javascript:alert(1)');
  });
});
