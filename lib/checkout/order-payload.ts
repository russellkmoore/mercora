'use client';

const PREFIX = 'mercora:pending-checkout:';

export interface PendingCheckout {
  orderId: string;
  paymentIntentId: string;
  savedAt: number;
}

export function savePendingCheckout(value: Omit<PendingCheckout, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${PREFIX}${value.paymentIntentId}`,
      JSON.stringify({ ...value, savedAt: Date.now() })
    );
  } catch {
    // Durable recovery is server/webhook-owned; browser storage is advisory.
  }
}

export function loadPendingCheckout(paymentIntentId: string): PendingCheckout | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${paymentIntentId}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingCheckout;
    return value.paymentIntentId === paymentIntentId && typeof value.orderId === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(paymentIntentId: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(`${PREFIX}${paymentIntentId}`);
    } catch {
      // Clearing advisory browser state must not make paid finalization fail.
    }
  }
}
