/**
 * Bounds shared by the chat client and the chat route.
 *
 * The route rejects an oversized body rather than truncating it, because a
 * hostile caller must not be able to spend prompt budget by sending more than
 * the contract allows. That makes these numbers a contract rather than a
 * server-side detail: the first-party client has to trim to them before it
 * posts, or a customer whose data legitimately grows past one of them gets a
 * hard 400 for every message.
 *
 * Import these on both sides. Do not copy the values.
 */

/** Orders included as purchase context. The client sends the most recent. */
export const MAX_ORDERS = 3;

/** Characters of formatted user context. */
export const MAX_USER_CONTEXT_LENGTH = 1_000;

/**
 * Newest first, bounded to MAX_ORDERS. Orders without a timestamp sort last so
 * a missing created_at cannot displace a known-recent order.
 */
export function selectRecentOrders<T extends { created_at?: string }>(
  orders: readonly T[],
): T[] {
  return [...orders]
    .sort((a, b) => {
      const left = a.created_at ? Date.parse(a.created_at) : Number.NaN;
      const right = b.created_at ? Date.parse(b.created_at) : Number.NaN;
      const leftValid = Number.isFinite(left);
      const rightValid = Number.isFinite(right);
      if (!leftValid && !rightValid) return 0;
      if (!leftValid) return 1;
      if (!rightValid) return -1;
      return right - left;
    })
    .slice(0, MAX_ORDERS);
}
