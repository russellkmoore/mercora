import { Money } from '@/lib/money';
import { getStoreConfig } from '@/lib/store-config';
import { sendEmail, type EmailResult } from '@/lib/email/sender';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';
import { postalFooterHtml, postalFooterText } from '@/lib/email/footer';

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
  ${postalFooterHtml()}
</body></html>`;

  const text = [
    `${store.identity.name}: Refund processed`,
    `Hi ${customerName},`,
    `We processed a refund of ${amount} for order #${input.orderId}.`,
    'Your bank may take several business days to show the credit.',
    `Questions? Contact ${store.contact.supportEmail}.`,
    postalFooterText(),
  ].join('\n\n');

  return sendEmail({
    from: store.contact.senderEmail,
    to: [input.customerEmail],
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
    subject: `Refund processed for order #${input.orderId} - ${store.identity.name}`,
    html,
    text,
  }, { idempotencyKey: `refund/${input.refundId}/succeeded/v1` });
}
