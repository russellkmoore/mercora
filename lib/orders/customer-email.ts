/**
 * Resolve the persisted customer email used by server-side order effects.
 *
 * The client never supplies a recipient to fulfillment endpoints. Checkout
 * writes the canonical email into extensions, while older orders may carry it
 * on the persisted shipping address.
 */

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function getOrderCustomerEmail(order: {
  extensions?: Record<string, unknown> | null;
  shipping_address?: unknown;
}): string | null {
  const extensionEmail = normalizeEmail(order.extensions?.email);
  if (extensionEmail) return extensionEmail;

  const address = order.shipping_address;
  if (address && typeof address === "object" && !Array.isArray(address)) {
    return normalizeEmail((address as Record<string, unknown>).email);
  }

  return null;
}
