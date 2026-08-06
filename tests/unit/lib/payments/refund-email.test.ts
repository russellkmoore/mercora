import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@/lib/utils/email', () => ({
  getResendClient: () => ({ emails: { send: mocks.send } }),
}));
vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: 'Test Store' },
    contact: { senderEmail: 'Test Store <orders@example.com>', supportEmail: 'help@example.com' },
  }),
}));

import { sendRefundSettledEmail } from '@/lib/payments/refund-email';

beforeEach(() => {
  mocks.send.mockResolvedValue({ data: { id: 'email_1' }, error: null });
});

describe('refund settlement email', () => {
  it('uses generic store identity and a refund-stable provider key', async () => {
    await expect(sendRefundSettledEmail({
      orderId: 'WEB-1', refundId: 're_1', amount: 425, currencyCode: 'USD',
      customerEmail: 'customer@example.com', customerName: '<Customer>',
    })).resolves.toEqual({ success: true, id: 'email_1' });

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Test Store <orders@example.com>',
      to: ['customer@example.com'],
      subject: 'Refund processed for order #WEB-1 - Test Store',
      html: expect.stringContaining('&lt;Customer&gt;'),
    }), { idempotencyKey: 'refund/re_1/succeeded/v1' });
  });

  it('is a no-op when the order has no customer email', async () => {
    await expect(sendRefundSettledEmail({
      orderId: 'WEB-1', refundId: 're_1', amount: 425, currencyCode: 'USD',
    })).resolves.toEqual({ success: true });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
