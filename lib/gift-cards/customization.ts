import type { GiftCardCustomization } from '@/lib/types/cartitem';

export const GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH = 254;
export const GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH = 100;
export const GIFT_CARD_MESSAGE_MAX_LENGTH = 500;

const ALLOWED_KEYS = new Set([
  'recipientEmail',
  'recipientName',
  'message',
  'deliveryDate',
]);
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

/**
 * URL-like shapes rejected in a gift message.
 *
 * The note is rendered into a transactional email sent from the store's own
 * sending domain, in a message that also carries a redemption code. Most mail
 * clients autolink a bare URL in the text/plain part, so a buyer-authored link
 * there is a ready-made phishing frame on a domain with passing SPF and DKIM.
 * The only cost of sending one is a paid gift card.
 *
 * Three shapes are rejected, deliberately blunt rather than clever:
 *
 *   1. an explicit scheme      -- http:// or https://
 *   2. a www. host prefix      -- www.example.com
 *   3. a bare host with a path -- example.com/anything
 *
 * A bare host with no path (example.com) is allowed on purpose: requiring the
 * trailing slash keeps ordinary prose out of the net ("see you at 5.30pm",
 * "U.S./Canada"), and without a path most clients do not autolink it.
 */
const URL_LIKE_PATTERNS: readonly RegExp[] = [
  /https?:\/\//iu,
  /\bwww\./iu,
  /\b[a-z0-9][a-z0-9-]*\.[a-z]{2,}\//iu,
];

function containsUrlLike(value: string): boolean {
  return URL_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

export class GiftCardCustomizationValidationError extends Error {
  constructor() {
    super('Invalid gift-card customization');
    this.name = 'GiftCardCustomizationValidationError';
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedOptionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    throw new GiftCardCustomizationValidationError();
  }
  const normalized = value.normalize('NFC').trim().replace(/[\t ]+/gu, ' ');
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new GiftCardCustomizationValidationError();
  }
  return normalized;
}

function normalizedMessage(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value)) {
    throw new GiftCardCustomizationValidationError();
  }
  const normalized = value
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[\t ]+/gu, ' '))
    .join('\n')
    .trim();
  if (
    normalized.length === 0 ||
    normalized.length > GIFT_CARD_MESSAGE_MAX_LENGTH ||
    containsUrlLike(normalized)
  ) {
    throw new GiftCardCustomizationValidationError();
  }
  return normalized;
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== 'string') throw new GiftCardCustomizationValidationError();
  const normalized = value.normalize('NFC').trim().toLowerCase();
  const [local = '', domain = '', ...rest] = normalized.split('@');
  if (
    normalized.length === 0 ||
    normalized.length > GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH ||
    local.length > 64 ||
    domain.length > 253 ||
    rest.length > 0 ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    throw new GiftCardCustomizationValidationError();
  }
  return normalized;
}

function normalizedDeliveryDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new GiftCardCustomizationValidationError();
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new GiftCardCustomizationValidationError();
  }
  return value;
}

/**
 * Parse the only gift-card details that may cross cart/client boundaries.
 * Bearer codes, redemption tokens, and unknown fields are rejected.
 */
export function parseGiftCardCustomization(value: unknown): GiftCardCustomization {
  if (!isPlainRecord(value) || Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new GiftCardCustomizationValidationError();
  }

  const customization: GiftCardCustomization = {
    recipientEmail: normalizedEmail(value.recipientEmail),
  };
  const recipientName = normalizedOptionalText(
    value.recipientName,
    GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH,
  );
  const message = normalizedMessage(value.message);
  const deliveryDate = normalizedDeliveryDate(value.deliveryDate);
  if (recipientName !== undefined) customization.recipientName = recipientName;
  if (message !== undefined) customization.message = message;
  if (deliveryDate !== undefined) customization.deliveryDate = deliveryDate;
  return customization;
}

export function canonicalGiftCardCustomization(value: GiftCardCustomization): string {
  const parsed = parseGiftCardCustomization(value);
  return JSON.stringify([
    parsed.recipientEmail,
    parsed.recipientName ?? null,
    parsed.message ?? null,
    parsed.deliveryDate ?? null,
  ]);
}

/**
 * Field-level error codes for the recipient form's per-field validators
 * (D-06). These wrap the private normalisers above so the client can never
 * be more permissive than parseGiftCardCustomization — every validator
 * below delegates to the same normaliser the whole-object gate uses.
 */
export type GiftCardFieldError =
  | 'required'
  | 'invalid_format'
  | 'too_long'
  | 'control_characters'
  | 'out_of_range';

export function validateGiftCardRecipientEmail(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return 'required';
  try {
    normalizedEmail(value);
    return null;
  } catch {
    if (CONTROL_CHARACTERS.test(value)) return 'control_characters';
    const normalized = value.normalize('NFC').trim().toLowerCase();
    if (normalized.length > GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH) return 'too_long';
    return 'invalid_format';
  }
}

export function validateGiftCardRecipientName(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return null;
  try {
    normalizedOptionalText(value, GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH);
    return null;
  } catch {
    return CONTROL_CHARACTERS.test(value) ? 'control_characters' : 'too_long';
  }
}

export function validateGiftCardMessage(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return null;
  try {
    normalizedMessage(value);
    return null;
  } catch {
    if (CONTROL_CHARACTERS.test(value)) return 'control_characters';
    if (containsUrlLike(value)) return 'invalid_format';
    return 'too_long';
  }
}

/**
 * Local-calendar-date string (YYYY-MM-DD) for a Date, built from local date
 * components rather than `toISOString()` — `toISOString()` always reports
 * the UTC calendar date, which is tomorrow's date for any shopper west of
 * UTC once local clock time crosses the UTC-midnight rollover (all US time
 * zones, most evenings). Used only for the default "today" reference below;
 * an explicit `todayIso` argument always wins.
 */
function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The client-only calendar bound (today through one year out) is stricter
 * than the server: normalizedDeliveryDate accepts any real calendar date.
 * This is a UX guard, never a place the client is more permissive than the
 * server that would let an invalid value slip through.
 */
export function validateGiftCardDeliveryDate(
  value: string,
  todayIso?: string,
): GiftCardFieldError | null {
  if (value.trim().length === 0) return null;
  try {
    normalizedDeliveryDate(value);
  } catch {
    return 'invalid_format';
  }
  const referenceDay = todayIso ?? localIsoDate(new Date());
  const [year, month, day] = referenceDay.split('-').map(Number);
  const upperBoundDate = new Date(Date.UTC(year, month - 1, day));
  upperBoundDate.setUTCFullYear(upperBoundDate.getUTCFullYear() + 1);
  const upperBound = upperBoundDate.toISOString().slice(0, 10);
  if (value < referenceDay || value > upperBound) return 'out_of_range';
  return null;
}
