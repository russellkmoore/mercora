import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  createToken: vi.fn(),
}));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.send }));
vi.mock('@/lib/email/unsubscribe-token', () => ({ createUnsubscribeToken: mocks.createToken }));
vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: 'Example Store' },
    contact: {
      senderEmail: 'Example Store <orders@example.test>',
      supportEmail: 'help@example.test',
      postalAddress: '1 Example Street',
    },
    urls: { site: 'https://shop.example.test' },
  }),
}));

import { sendReviewReminderEmail, sendReviewStatusNotification } from '@/lib/utils/review-notifications';

beforeEach(() => {
  mocks.send.mockResolvedValue({ success: true, id: 'email-1', provider: 'cloudflare' });
  mocks.createToken.mockResolvedValue('signed-token');
});

describe('review notifications', () => {
  it('adds signed unsubscribe links and a deterministic review-reminder key', async () => {
    await sendReviewReminderEmail({
      email: 'customer@example.test', name: '<Customer>', productName: '<Product>',
      orderId: 'ORDER-1', productId: 'PRODUCT-1',
    });

    const [message, options] = mocks.send.mock.calls[0];
    expect(message.headers).toEqual({
      'List-Unsubscribe': '<https://shop.example.test/api/email/unsubscribe?token=signed-token>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(message.html).toContain('&lt;Product&gt;');
    expect(message.html).toContain('Example Store');
    expect(options).toEqual({ idempotencyKey: 'review-reminder/ORDER-1/PRODUCT-1/v1' });
  });

  it('fails closed before delivery when unsubscribe tokens are unavailable', async () => {
    mocks.createToken.mockResolvedValue(null);
    await expect(sendReviewReminderEmail({
      email: 'customer@example.test', productName: 'Product', orderId: 'ORDER-1', productId: 'PRODUCT-1',
    })).rejects.toThrow('unsubscribe-token');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('routes transactional review status mail through the same sender', async () => {
    await sendReviewStatusNotification({
      email: 'customer@example.test', productName: '<Product>', status: 'published',
      adminResponse: '<Response>', idempotencyKey: 'review-status/1/v1',
    });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('&lt;Response&gt;'),
      text: expect.stringContaining('<Response>'),
    }), { idempotencyKey: 'review-status/1/v1' });
  });
});
