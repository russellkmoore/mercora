'use client';

const PREFIX = 'mercora:pending-checkout:';

export interface PendingCheckout {
  orderId: string;
  paymentIntentId: string;
  savedAt: number;
}

export function savePendingCheckout(value: Omit<PendingCheckout, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${PREFIX}${value.paymentIntentId}`,
    JSON.stringify({ ...value, savedAt: Date.now() })
  );
}

export function loadPendingCheckout(paymentIntentId: string): PendingCheckout | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`${PREFIX}${paymentIntentId}`);
  if (!raw) return null;
  try {
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
    window.localStorage.removeItem(`${PREFIX}${paymentIntentId}`);
  }
}
