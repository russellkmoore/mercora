import { Money } from "@/lib/money";
import type { GiftCardCodeLookup } from "./code";

export const MAX_GIFT_CARD_INTEGER = Number.MAX_SAFE_INTEGER;
export const GIFT_CARD_HASH_PATTERN = /^[0-9a-f]{64}$/;
export const GIFT_CARD_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export type GiftCardAccountStatus = "active" | "disabled";
export type GiftCardLedgerEntryType =
  | "issuance"
  | "redemption"
  | "restoration"
  | "adjustment";
export type GiftCardDeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "needs_review";

export type GiftCardCodeHash = GiftCardCodeLookup;

export interface GiftCardAccount {
  id: string;
  codeHash: GiftCardCodeHash;
  currency: string;
  status: GiftCardAccountStatus;
  issuanceEntryId: string;
  issuanceBusinessKey: string;
  issuedAmount: Money;
  issuedOrderId?: string;
  issuedLineId?: string;
  purchaserCustomerId?: string;
  createdAt: number;
  disabledAt?: number;
}

export interface GiftCardReservation {
  id: string;
  giftCardId: string;
  requestKey: string;
  quoteFingerprint: string;
  requestedAmount: Money;
  amount: Money;
  reservedAt: number;
  expiresAt: number;
  committedOrderId?: string;
  committedAt?: number;
  releasedAt?: number;
  releaseReason?: string;
}

export interface GiftCardLedgerEntry {
  id: string;
  giftCardId: string;
  entryType: GiftCardLedgerEntryType;
  amountDelta: Money;
  businessKey: string;
  orderId?: string;
  reservationId?: string;
  relatedEntryId?: string;
  createdAt: number;
}

export interface GiftCardDelivery {
  id: string;
  giftCardId: string;
  orderId?: string;
  orderLineId?: string;
  recipientEmail: string;
  recipientName?: string;
  emailIdempotencyKey: string;
  status: GiftCardDeliveryStatus;
  attemptCount: number;
  claimToken?: string;
  leaseExpiresAt?: number;
  /** AEAD fields only. A plaintext bearer code is never a domain field. */
  codeCiphertext?: string;
  codeNonce?: string;
  codeKeyVersion?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface IssueGiftCardInput {
  id: string;
  codeHash: GiftCardCodeHash;
  amount: Money;
  issuedOrderId?: string;
  issuedLineId?: string;
  purchaserCustomerId?: string;
  createdAt: number;
  delivery?: {
    id: string;
    recipientEmail: string;
    recipientName?: string;
    emailIdempotencyKey: string;
    codeCiphertext: string;
    codeNonce: string;
    codeKeyVersion: number;
    /** Earliest epoch second the recipient may be emailed; 0 means immediately. */
    deliverAfter?: number;
  };
}

export interface ReserveGiftCardInput {
  id: string;
  giftCardId: string;
  requestKey: string;
  quoteFingerprint: string;
  requestedAmount: Money;
  reservedAt: number;
  expiresAt: number;
}

function assertBoundedText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): asserts value is string {
  if (
    typeof value !== "string"
    || value.length < minimum
    || value.length > maximum
    || value.trim() !== value
  ) {
    throw new TypeError(`${label} must be a bounded non-whitespace string`);
  }
}

export function assertGiftCardId(value: unknown, label = "gift-card id"): asserts value is string {
  assertBoundedText(value, label, 1, 128);
}

export function assertGiftCardBusinessKey(value: unknown): asserts value is string {
  assertBoundedText(value, "gift-card business key", 1, 256);
}

export function assertGiftCardEpoch(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TypeError(`${label} must be nonnegative integer epoch seconds`);
  }
}

export function assertGiftCardCurrency(value: unknown): asserts value is string {
  if (typeof value !== "string" || !GIFT_CARD_CURRENCY_PATTERN.test(value)) {
    throw new TypeError("gift-card currency must be an uppercase ISO 4217 code");
  }
}

export function assertGiftCardCodeHash(value: GiftCardCodeHash): void {
  if (!Number.isSafeInteger(value.keyVersion) || value.keyVersion < 1) {
    throw new TypeError("gift-card code hash key version must be a positive safe integer");
  }
  if (!GIFT_CARD_HASH_PATTERN.test(value.digest)) {
    throw new TypeError("gift-card code hash must be 64 lowercase hexadecimal characters");
  }
}

export function assertGiftCardMoney(value: Money, options: { positive?: boolean } = {}): void {
  if (!(value instanceof Money)) throw new TypeError("gift-card amount must be Money");
  assertGiftCardCurrency(value.currency);
  if (value.isNegative() || (options.positive && value.isZero())) {
    throw new TypeError(options.positive
      ? "gift-card amount must be positive"
      : "gift-card amount must be nonnegative");
  }
}

export function giftCardIssuanceBusinessKey(giftCardId: string): string {
  assertGiftCardId(giftCardId);
  return `gift-card/issuance/${giftCardId}/v1`;
}

export function giftCardRedemptionBusinessKey(reservationId: string): string {
  assertGiftCardId(reservationId, "gift-card reservation id");
  return `gift-card/redemption/${reservationId}/v1`;
}

export function giftCardRestorationBusinessKey(redemptionEntryId: string, refundKey: string): string {
  assertGiftCardId(redemptionEntryId, 'gift-card redemption entry id');
  assertBoundedText(refundKey, 'gift-card refund key', 1, 128);
  const key = `gift-card/restoration/${redemptionEntryId}/${refundKey}/v1`;
  assertGiftCardBusinessKey(key);
  return key;
}

export function assertIssueGiftCardInput(input: IssueGiftCardInput): void {
  assertGiftCardId(input.id);
  assertGiftCardCodeHash(input.codeHash);
  assertGiftCardMoney(input.amount, { positive: true });
  assertGiftCardEpoch(input.createdAt, "gift-card issuance time");
  if ((input.issuedOrderId === undefined) !== (input.issuedLineId === undefined)) {
    throw new TypeError("gift-card issuance order and line attribution must appear together");
  }
  if (input.issuedOrderId !== undefined) {
    assertBoundedText(input.issuedOrderId, "gift-card issuance order id", 1, 200);
    assertGiftCardId(input.issuedLineId, "gift-card issuance line id");
  }
  if (input.purchaserCustomerId !== undefined) {
    assertGiftCardId(input.purchaserCustomerId, "gift-card purchaser customer id");
  }
  if (input.delivery !== undefined) {
    assertGiftCardId(input.delivery.id, 'gift-card delivery id');
    assertBoundedText(input.delivery.recipientEmail, 'gift-card delivery recipient', 3, 320);
    if (input.delivery.recipientName !== undefined) {
      assertBoundedText(input.delivery.recipientName, 'gift-card delivery recipient name', 1, 200);
    }
    assertBoundedText(input.delivery.emailIdempotencyKey, 'gift-card delivery idempotency key', 1, 256);
    if (
      !Number.isSafeInteger(input.delivery.codeKeyVersion) || input.delivery.codeKeyVersion < 1 ||
      typeof input.delivery.codeCiphertext !== 'string' || input.delivery.codeCiphertext.length > 128 ||
      typeof input.delivery.codeNonce !== 'string' || input.delivery.codeNonce.length > 32
    ) throw new TypeError('gift-card delivery encryption state is invalid');
    if (input.delivery.deliverAfter !== undefined) {
      assertGiftCardEpoch(input.delivery.deliverAfter, 'gift-card delivery schedule');
    }
  }
}

export function assertReserveGiftCardInput(input: ReserveGiftCardInput): void {
  assertGiftCardId(input.id, "gift-card reservation id");
  assertGiftCardId(input.giftCardId);
  assertBoundedText(input.requestKey, "gift-card reservation request key", 8, 256);
  if (!GIFT_CARD_HASH_PATTERN.test(input.quoteFingerprint)) {
    throw new TypeError("gift-card quote fingerprint must be 64 lowercase hexadecimal characters");
  }
  assertGiftCardMoney(input.requestedAmount, { positive: true });
  assertGiftCardEpoch(input.reservedAt, "gift-card reservation time");
  assertGiftCardEpoch(input.expiresAt, "gift-card reservation expiry");
  if (input.expiresAt <= input.reservedAt) {
    throw new TypeError("gift-card reservation expiry must follow its reservation time");
  }
}

export function assertGiftCardReleaseReason(value: unknown): asserts value is string {
  assertBoundedText(value, "gift-card release reason", 1, 200);
}
