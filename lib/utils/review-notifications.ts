import type { ReviewStatus } from '@/lib/types';
import { getResendClient } from '@/lib/utils/email';

interface ReviewStatusNotificationInput {
  email: string;
  name?: string;
  productName: string;
  status: ReviewStatus;
  adminResponse?: string;
  reviewBody?: string;
  rating?: number;
  event?: 'status_change' | 'response';
}

interface ReviewReminderEmailInput {
  email: string;
  name?: string;
  productName: string;
  orderId: string;
}

function formatStatus(status: ReviewStatus) {
  switch (status) {
    case 'published':
      return 'approved';
    case 'needs_review':
      return 'awaiting moderation';
    case 'suppressed':
      return 'held back';
    case 'auto_rejected':
      return 'rejected';
    case 'pending':
    default:
      return 'pending review';
  }
}

export async function sendReviewStatusNotification(input: ReviewStatusNotificationInput): Promise<void> {
  const resend = getResendClient();
  const greeting = input.name ? `Hi ${input.name.split(' ')[0]},` : 'Hi there,';
  const statusLabel = formatStatus(input.status);
  const subjectPrefix = input.event === 'response' ? 'We replied to your review' : `Your review was ${statusLabel}`;
  const subject = `${subjectPrefix} · ${input.productName}`;

  const responseSection = input.adminResponse
    ? `
        <div style="margin-top: 16px; padding: 16px; background-color: #111827; border-radius: 8px;">
          <h3 style="margin: 0 0 8px; color: #f97316; font-size: 16px; font-weight: 600;">Store response</h3>
          <p style="margin: 0; color: #e5e7eb; line-height: 22px;">${input.adminResponse.replace(/\n/g, '<br />')}</p>
        </div>
      `
    : '';

  const reviewDetails = input.reviewBody
    ? `
        <div style="margin-top: 16px; padding: 16px; background-color: #1f2937; border-radius: 8px;">
          <h3 style="margin: 0 0 8px; color: #f9fafb; font-size: 16px; font-weight: 600;">Your review</h3>
          ${typeof input.rating === 'number'
            ? `<p style="margin: 0 0 12px; color: #fbbf24; font-weight: 600;">${'★'.repeat(Math.round(input.rating))}${'☆'.repeat(5 - Math.round(input.rating))}</p>`
            : ''}
          <p style="margin: 0; color: #d1d5db; line-height: 22px;">${input.reviewBody.replace(/\n/g, '<br />')}</p>
        </div>
      `
    : '';

  const html = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0f172a; padding: 32px; color: #f9fafb;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #111827; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #f97316;">Voltique Reviews</h2>
        <p style="margin: 16px 0 0; color: #e5e7eb; line-height: 24px;">${greeting}</p>
        <p style="margin: 12px 0 0; color: #d1d5db; line-height: 24px;">
          ${input.event === 'response'
            ? 'Our merchandising team just replied to your feedback.'
            : `We wanted to let you know the status of your review for <strong>${input.productName}</strong>.`}
        </p>
        <div style="margin-top: 16px; padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff;">
          <p style="margin: 0; font-size: 18px; font-weight: 700;">${input.productName}</p>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Current status: ${statusLabel}</p>
        </div>
        ${reviewDetails}
        ${responseSection}
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px; line-height: 22px;">
          Thanks again for taking the time to share your experience. Your feedback helps fellow adventurers choose the right gear.
        </p>
        <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">— Voltique Merchandising Team</p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: 'Voltique Reviews <volt@russellkmoore.me>',
    to: [input.email],
    subject,
    html,
  });
}

export async function sendReviewReminderEmail(input: ReviewReminderEmailInput): Promise<void> {
  const resend = getResendClient();
  const greeting = input.name ? `Hi ${input.name.split(' ')[0]},` : 'Hi there,';

  const html = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0f172a; padding: 32px; color: #f9fafb;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #111827; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #f97316;">How's your new gear?</h2>
        <p style="margin: 16px 0 0; color: #e5e7eb; line-height: 24px;">${greeting}</p>
        <p style="margin: 12px 0 0; color: #d1d5db; line-height: 24px;">
          We hope you're putting <strong>${input.productName}</strong> to good use. When you have a moment, we'd love to hear how it's working out.
        </p>
        <a href="https://voltique.russellkmoore.me/account/orders/${input.orderId}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; border-radius: 9999px; text-decoration: none; font-weight: 600;">Share your review</a>
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px; line-height: 22px;">
          Reviews help other shoppers make confident choices and give our team insight into what to improve next.
        </p>
        <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">If you've already shared your thoughts, thank you! You can ignore this reminder.</p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: 'Voltique Reviews <volt@russellkmoore.me>',
    to: [input.email],
    subject: `How's your ${input.productName}?`,
    html,
  });
}
