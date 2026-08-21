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
  if (normalized.length === 0 || normalized.length > GIFT_CARD_MESSAGE_MAX_LENGTH) {
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
