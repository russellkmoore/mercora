import type { ReviewStatus } from '@/lib/types';
import { sendEmail } from '@/lib/email/sender';
import { getStoreConfig } from '@/lib/store-config';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';
import {
  postalFooterHtml,
  postalFooterText,
  unsubscribeFooterHtml,
} from '@/lib/email/footer';
import { createUnsubscribeToken } from '@/lib/email/unsubscribe-token';

interface ReviewStatusNotificationInput {
  email: string;
  name?: string;
  productName: string;
  status: ReviewStatus;
  adminResponse?: string;
  reviewBody?: string;
  rating?: number;
  event?: 'status_change' | 'response';
  idempotencyKey?: string;
}

interface ReviewReminderEmailInput {
  email: string;
  name?: string;
  productName: string;
  orderId: string;
  productId: string;
}

function formatStatus(status: ReviewStatus) {
  switch (status) {
    case 'published': return 'approved';
    case 'needs_review': return 'awaiting moderation';
    case 'suppressed': return 'held back';
    case 'auto_rejected': return 'rejected';
    case 'pending':
    default: return 'pending review';
  }
}

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] || 'there';
}

function plain(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function throwOnFailure(result: Awaited<ReturnType<typeof sendEmail>>): void {
  if (!result.success) throw new Error(result.error || 'Email delivery failed');
}

export async function sendReviewStatusNotification(input: ReviewStatusNotificationInput): Promise<void> {
  const store = getStoreConfig();
  const statusLabel = formatStatus(input.status);
  const subjectPrefix = input.event === 'response'
    ? 'We replied to your review'
    : `Your review was ${statusLabel}`;
  const subject = `${subjectPrefix} - ${plain(input.productName)}`;
  const responseSection = input.adminResponse
    ? `<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px"><h3>Store response</h3><p style="white-space:pre-line">${escapeHtmlText(input.adminResponse)}</p></div>`
    : '';
  const reviewDetails = input.reviewBody
    ? `<div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px"><h3>Your review</h3>${typeof input.rating === 'number' ? `<p>${'★'.repeat(Math.round(input.rating))}${'☆'.repeat(5 - Math.round(input.rating))}</p>` : ''}<p style="white-space:pre-line">${escapeHtmlText(input.reviewBody)}</p></div>`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>${escapeHtmlText(store.identity.name)} Reviews</h2><p>Hi ${escapeHtmlText(firstName(input.name))},</p><p>${input.event === 'response' ? 'Our team replied to your feedback.' : `The status of your review for <strong>${escapeHtmlText(input.productName)}</strong> has changed.`}</p><p><strong>Current status:</strong> ${escapeHtmlText(statusLabel)}</p>${reviewDetails}${responseSection}<p>Thank you for sharing your experience.</p>${postalFooterHtml()}</div>`;
  const text = [
    `${store.identity.name} Reviews`,
    `Hi ${firstName(input.name)},`,
    input.event === 'response'
      ? `Our team replied to your review of ${input.productName}.`
      : `Your review of ${input.productName} is ${statusLabel}.`,
    input.reviewBody ? `Your review: ${input.reviewBody}` : null,
    input.adminResponse ? `Store response: ${input.adminResponse}` : null,
    postalFooterText(),
  ].filter((line): line is string => line !== null).join('\n\n');

  const result = await sendEmail({
    from: store.contact.senderEmail,
    to: [input.email],
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
    subject,
    html,
    text,
  }, { idempotencyKey: input.idempotencyKey });
  throwOnFailure(result);
}

export async function sendReviewReminderEmail(input: ReviewReminderEmailInput): Promise<void> {
  const store = getStoreConfig();
  const token = await createUnsubscribeToken(input.email, 'review_reminders');
  if (!token) throw new Error('Review reminders require unsubscribe-token configuration');
  const reviewUrl = new URL('/account/orders', store.urls.site).href;
  const unsubscribeUrl = new URL('/api/email/unsubscribe', store.urls.site);
  unsubscribeUrl.searchParams.set('token', token);
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>How is your purchase working out?</h2><p>Hi ${escapeHtmlText(firstName(input.name))},</p><p>We would appreciate your review of <strong>${escapeHtmlText(input.productName)}</strong> from order <strong>${escapeHtmlText(input.orderId)}</strong>.</p><p><a href="${escapeHtmlText(reviewUrl)}">Share your review</a></p><p>If you have already shared your thoughts, thank you. You can ignore this reminder.</p>${unsubscribeFooterHtml(unsubscribeUrl.href)}${postalFooterHtml()}</div>`;
  const text = [
    `${store.identity.name}: Review your purchase`,
    `Hi ${firstName(input.name)},`,
    `We would appreciate your review of ${input.productName} from order ${input.orderId}.`,
    `Share your review: ${reviewUrl}`,
    `Unsubscribe from review reminders: ${unsubscribeUrl.href}`,
    postalFooterText(),
  ].join('\n\n');
  const result = await sendEmail({
    from: store.contact.senderEmail,
    to: [input.email],
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
    subject: `How is your ${plain(input.productName)}?`,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl.href}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }, {
    idempotencyKey: `review-reminder/${input.orderId}/${input.productId}/v1`,
  });
  throwOnFailure(result);
}
