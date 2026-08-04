import type { CartItem } from "@/lib/types/cartitem";

export const MAX_PUBLIC_ARRAY_ITEMS = 100;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isBoundedString(
  value: unknown,
  maxLength: number,
  options: { allowEmpty?: boolean } = {}
): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  return options.allowEmpty ? true : value.trim().length > 0;
}

export function isBoundedArray(
  value: unknown,
  maxItems = MAX_PUBLIC_ARRAY_ITEMS
): value is unknown[] {
  return Array.isArray(value) && value.length <= maxItems;
}

/** Validate the shallow cart shape before Money or external-service work. */
export function isValidPublicCartItems(value: unknown): value is CartItem[] {
  if (!isBoundedArray(value) || value.length === 0) return false;

  return value.every((candidate) => {
    if (!isPlainRecord(candidate)) return false;

    return (
      isBoundedString(candidate.productId, 128) &&
      isBoundedString(candidate.variantId, 128) &&
      isBoundedString(candidate.name, 256) &&
      isBoundedString(candidate.primaryImageUrl, 2048, { allowEmpty: true }) &&
      Number.isInteger(candidate.quantity) &&
      Number(candidate.quantity) > 0 &&
      Number(candidate.quantity) <= 1_000 &&
      isPlainRecord(candidate.price)
    );
  });
}
