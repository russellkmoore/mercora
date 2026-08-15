import {
  canonicalGiftCardCustomization,
  parseGiftCardCustomization,
} from '@/lib/gift-cards/customization';
import { Money } from '@/lib/money';
import type {
  CartItem,
  GiftCardCustomization,
  StableCartItem,
} from '@/lib/types/cartitem';

export const MAX_CART_LINE_QUANTITY = 1_000;

export interface CheckoutCartLineProjection {
  lineId: string;
  productId: string;
  variantId: string;
  quantity: number;
  giftCardCustomization?: GiftCardCustomization;
}

interface CartLineFacts {
  productId: string;
  variantId: string;
  giftCardCustomization?: GiftCardCustomization;
}

function boundedText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function canonicalLineFacts(facts: CartLineFacts): string {
  return JSON.stringify([
    facts.productId,
    facts.variantId,
    facts.giftCardCustomization
      ? canonicalGiftCardCustomization(facts.giftCardCustomization)
      : null,
  ]);
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= code >>> 8;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}

export function createCartLineId(facts: CartLineFacts): string {
  const canonical = canonicalLineFacts(facts);
  return `line_${hex32(fnv1a(canonical, 0x811c9dc5))}${hex32(fnv1a(canonical, 0x9e3779b9))}`;
}

export function sameCartLineFacts(left: CartLineFacts, right: CartLineFacts): boolean {
  return canonicalLineFacts(left) === canonicalLineFacts(right);
}

/** Project an untrusted or legacy item into the exact persisted cart shape. */
export function normalizeCartItemForStore(value: unknown): StableCartItem | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<CartItem>;
  if (
    !boundedText(candidate.productId, 128) ||
    !boundedText(candidate.variantId, 128) ||
    !boundedText(candidate.name, 256) ||
    !boundedText(candidate.primaryImageUrl, 2_048, true) ||
    !Number.isSafeInteger(candidate.quantity) ||
    Number(candidate.quantity) < 1 ||
    Number(candidate.quantity) > MAX_CART_LINE_QUANTITY
  ) {
    return null;
  }

  let price;
  let giftCardCustomization: GiftCardCustomization | undefined;
  try {
    price = Money.fromStored(candidate.price).toJSON();
    if (candidate.giftCardCustomization !== undefined) {
      giftCardCustomization = parseGiftCardCustomization(candidate.giftCardCustomization);
    }
  } catch {
    return null;
  }

  const facts: CartLineFacts = {
    productId: candidate.productId,
    variantId: candidate.variantId,
    ...(giftCardCustomization ? { giftCardCustomization } : {}),
  };
  return {
    lineId: createCartLineId(facts),
    productId: candidate.productId,
    variantId: candidate.variantId,
    name: candidate.name,
    price,
    quantity: Number(candidate.quantity),
    primaryImageUrl: candidate.primaryImageUrl,
    ...(giftCardCustomization ? { giftCardCustomization } : {}),
  };
}

export function projectCartLineForCheckout(item: StableCartItem): CheckoutCartLineProjection {
  const normalized = normalizeCartItemForStore(item);
  if (
    !normalized ||
    !/^line_[0-9a-f]{16}(?:_[2-9]\d*)?$/u.test(item.lineId)
  ) {
    throw new Error('Cart contains an invalid line');
  }
  return {
    // Preserve a deterministic collision suffix assigned by the store.
    lineId: item.lineId,
    productId: normalized.productId,
    variantId: normalized.variantId,
    quantity: normalized.quantity,
    ...(normalized.giftCardCustomization
      ? { giftCardCustomization: normalized.giftCardCustomization }
      : {}),
  };
}
