import { Money } from '@/lib/money';
import { getStoreConfig } from '@/lib/store-config';
import { getResendClient, type EmailResult } from '@/lib/utils/email';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';

export interface RefundSettledEmailInput {
  orderId: string;
  refundId: string;
  amount: number;
  currencyCode: string;
  customerEmail?: string;
  customerName?: string;
}

/** Send one provider-idempotent notification for a settled Stripe refund. */
export async function sendRefundSettledEmail(
  input: RefundSettledEmailInput
): Promise<EmailResult> {
  if (!input.customerEmail) return { success: true };
  const store = getStoreConfig();
  const amount = Money.fromMinor(input.amount, input.currencyCode).format();
  const customerName = input.customerName || 'Customer';
  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#1e293b">
  <h1>${escapeHtmlText(store.identity.name)}</h1>
  <p>Hi ${escapeHtmlText(customerName)},</p>
  <p>We processed a refund of <strong>${escapeHtmlText(amount)}</strong> for order
    <strong>#${escapeHtmlText(input.orderId)}</strong>.</p>
  <p>Your bank may take several business days to show the credit.</p>
  <p>Questions? Contact ${escapeHtmlText(store.contact.supportEmail)}.</p>
</body></html>`;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: store.contact.senderEmail,
      to: [input.customerEmail],
      subject: `Refund processed for order #${input.orderId} - ${store.identity.name}`,
      html,
    }, { idempotencyKey: `refund/${input.refundId}/succeeded/v1` });
    if (error) return { success: false, error: error.message || 'Refund email failed' };
    return { success: true, id: data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Refund email failed',
    };
  }
}
