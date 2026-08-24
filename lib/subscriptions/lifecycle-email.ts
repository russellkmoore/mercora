import {
  sendEmail,
  type EmailResult,
  type OutboundEmail,
} from '@/lib/email/sender';
import { getStoreConfig } from '@/lib/store-config';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';

export const SUBSCRIPTION_LIFECYCLE_EMAIL_TEMPLATE_VERSION = 1;

export type SubscriptionLifecycleNotificationKind =
  | 'created'
  | 'paused'
  | 'resumed'
  | 'cancel_scheduled'
  | 'canceled'
  | 'payment_failed'
  | 'payment_recovered';

export interface SubscriptionLifecycleNotificationRepository {
  findSubscriptionEventNotificationKind(
    eventAuditId: string,
  ): Promise<SubscriptionLifecycleNotificationKind | undefined>;
}

export interface SubscriptionLifecycleEmailInput {
  database: D1Database;
  subscriptionId: string;
  /** Event identity for lifecycle/failure; invoice identity for recovery aliases. */
  deliveryScope: string;
  kind: SubscriptionLifecycleNotificationKind;
}

export type SubscriptionLifecycleEmailResult =
  | { status: 'sent'; providerId?: string }
  | { status: 'skipped' }
  | { status: 'needs_review' };

export type SubscriptionLifecycleEmailSender = (
  message: OutboundEmail,
  options: { idempotencyKey: string; database: D1Database },
) => Promise<EmailResult>;

interface CustomerNotificationRow {
  person: string | null;
  contacts: string | null;
  current_period_end: number | null;
  cancel_at: number | null;
}

interface CustomerIdentity {
  email: string;
  name?: string;
}

interface NotificationCopy {
  subject: string;
  heading: string;
  paragraphs: string[];
}

/** Definite delivery failures use a deliberately payload-free retry signal. */
export class SubscriptionLifecycleEmailRetryError extends Error {
  constructor() {
    super('Subscription lifecycle notification delivery must be retried');
  }
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function parseObject(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function parseContacts(value: string | null): Array<Record<string, unknown>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
      : [];
  } catch {
    return [];
  }
}

function validEmail(value: unknown): string | undefined {
  const email = boundedText(value, 320)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function customerIdentity(row: CustomerNotificationRow): CustomerIdentity | undefined {
  const person = parseObject(row.person);
  const contacts = parseContacts(row.contacts);
  const primary = contacts.find((entry) => entry.is_primary === true) ?? contacts[0];
  const email = validEmail(person?.email) ?? validEmail(primary?.email);
  if (!email) return undefined;
  const nameParts = [boundedText(person?.first_name, 100), boundedText(person?.last_name, 100)]
    .filter((part): part is string => Boolean(part)).join(' ');
  const name = boundedText(person?.full_name, 200)
    ?? (nameParts || undefined)
    ?? boundedText(primary?.name, 200)
    ?? boundedText(primary?.full_name, 200);
  return { email, ...(name ? { name } : {}) };
}

async function findCustomerNotificationRow(
  database: D1Database,
  subscriptionId: string,
): Promise<CustomerNotificationRow | undefined> {
  return await database.prepare(`SELECT c.person, c.contacts,
    cs.current_period_end, cs.cancel_at
    FROM customer_subscriptions cs
    JOIN customers c ON c.id = cs.customer_id
    WHERE cs.id = ? LIMIT 1`)
    .bind(subscriptionId).first<CustomerNotificationRow>() ?? undefined;
}

function safeAccountUrl(siteUrl: string): string | undefined {
  try {
    const url = new URL('/account/subscriptions', siteUrl);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function formatEffectiveDate(row: CustomerNotificationRow, locale: string): string | undefined {
  const seconds = row.cancel_at ?? row.current_period_end;
  if (!Number.isSafeInteger(seconds) || seconds! < 0) return undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(seconds! * 1_000));
  } catch {
    return undefined;
  }
}

function notificationCopy(
  kind: SubscriptionLifecycleNotificationKind,
  effectiveDate?: string,
): NotificationCopy {
  switch (kind) {
    case 'created':
      return {
        subject: 'Your subscription was created',
        heading: 'Your subscription was created',
        paragraphs: ['We received your subscription request. Review its current status in your account.'],
      };
    case 'paused':
      return {
        subject: 'Your subscription is paused',
        heading: 'Your subscription is paused',
        paragraphs: ['Your subscription has been paused. You can review its current status in your account.'],
      };
    case 'resumed':
      return {
        subject: 'Your subscription has resumed',
        heading: 'Your subscription has resumed',
        paragraphs: ['Your subscription has resumed. Future orders will follow its current schedule.'],
      };
    case 'cancel_scheduled':
      return {
        subject: 'Your subscription cancellation is scheduled',
        heading: 'Cancellation scheduled',
        paragraphs: [effectiveDate
          ? `Your subscription is scheduled to end on ${effectiveDate}.`
          : 'Your subscription is scheduled to end after the current billing period.'],
      };
    case 'canceled':
      return {
        subject: 'Your subscription has ended',
        heading: 'Your subscription has ended',
        paragraphs: ['Your subscription has been canceled and no future subscription orders will be created.'],
      };
    case 'payment_failed':
      return {
        subject: 'Action may be needed for your subscription payment',
        heading: 'We could not process your subscription payment',
        paragraphs: [
          'We could not process a subscription payment. Review your subscription and payment details in your account.',
        ],
      };
    case 'payment_recovered':
      return {
        subject: 'Your subscription payment issue is resolved',
        heading: 'Your subscription payment issue is resolved',
        paragraphs: ['We received the subscription payment that previously failed. No further payment action is needed.'],
      };
  }
}

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function prepareEmail(
  identity: CustomerIdentity,
  row: CustomerNotificationRow,
  kind: SubscriptionLifecycleNotificationKind,
): OutboundEmail {
  const store = getStoreConfig();
  const copy = notificationCopy(kind, formatEffectiveDate(row, store.commerce.locale));
  const accountUrl = safeAccountUrl(store.urls.site);
  const greeting = identity.name ? `Hi ${identity.name},` : 'Hello,';
  const accountHtml = accountUrl
    ? `<p><a href="${escapeHtmlText(accountUrl)}">View your subscription</a></p>`
    : '';
  const accountText = accountUrl ? `View your subscription: ${accountUrl}` : undefined;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1e293b">
  <h1>${escapeHtmlText(copy.heading)}</h1>
  <p>${escapeHtmlText(greeting)}</p>
  ${copy.paragraphs.map((paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`).join('\n  ')}
  ${accountHtml}
  <p>Questions? Contact ${escapeHtmlText(store.contact.supportEmail)}.</p>
  <p style="color:#94a3b8;font-size:12px;line-height:16px">${escapeHtmlText(store.identity.name)} · ${escapeHtmlText(store.contact.postalAddress)}</p>
</body></html>`;
  const text = [
    `${store.identity.name}: ${copy.heading}`,
    greeting,
    ...copy.paragraphs,
    accountText,
    `Questions? Contact ${store.contact.supportEmail}.`,
    `${store.identity.name} · ${store.contact.postalAddress}`,
  ].filter((line): line is string => Boolean(line)).join('\n\n');
  return {
    from: store.contact.senderEmail,
    to: [identity.email],
    subject: `${singleLine(copy.subject)} - ${singleLine(store.identity.name)}`.slice(0, 200),
    html,
    text,
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
  };
}

export async function subscriptionLifecycleEmailKey(
  deliveryScope: string,
  kind: SubscriptionLifecycleNotificationKind,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${deliveryScope}\u0000${kind}`),
  );
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  return `subscription-lifecycle/${kind}/${hex}/v${SUBSCRIPTION_LIFECYCLE_EMAIL_TEMPLATE_VERSION}`;
}

/**
 * Sends a transactional lifecycle notice through the provider-neutral durable
 * sender. Missing current customer contact is a terminal no-op. Definite
 * failures throw a payload-free error so the core webhook claim can retry;
 * ambiguous accepted state remains terminal for operator reconciliation.
 */
export async function sendSubscriptionLifecycleEmail(
  input: SubscriptionLifecycleEmailInput,
  sender: SubscriptionLifecycleEmailSender = sendEmail,
): Promise<SubscriptionLifecycleEmailResult> {
  const row = await findCustomerNotificationRow(input.database, input.subscriptionId);
  const identity = row ? customerIdentity(row) : undefined;
  if (!row || !identity) return { status: 'skipped' };
  const result = await sender(prepareEmail(identity, row, input.kind), {
    idempotencyKey: await subscriptionLifecycleEmailKey(input.deliveryScope, input.kind),
    database: input.database,
  });
  if (result.success) {
    return { status: 'sent', ...(result.id ? { providerId: result.id } : {}) };
  }
  if (result.needsReview) return { status: 'needs_review' };
  throw new SubscriptionLifecycleEmailRetryError();
}
