'use client';

import { useCallback, useEffect, useState } from 'react';
import { Money, type MachMoney } from '@/lib/money';

interface GiftCardSummary {
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: 'active' | 'disabled';
  createdAt: number;
  delivery?: { status: 'pending' | 'processing' | 'sent' | 'needs_review'; attempts: number };
}

function formatMoney(value: MachMoney): string {
  return Money.fromMajor(value.amount, value.currency).format();
}

function deliveryLabel(status: GiftCardSummary['delivery']): string | undefined {
  if (!status) return undefined;
  if (status.status === 'sent') return 'Delivery sent';
  if (status.status === 'needs_review') return 'Delivery needs support review';
  return 'Delivery pending';
}

export function GiftCardDashboard() {
  const [cards, setCards] = useState<GiftCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/gift-cards');
      const payload = await response.json() as { cards?: GiftCardSummary[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Gift cards could not be loaded');
      setCards(Array.isArray(payload.cards) ? payload.cards : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gift cards could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/gift-cards')
      .then(async (response) => {
        const payload = await response.json() as { cards?: GiftCardSummary[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Gift cards could not be loaded');
        if (active) setCards(Array.isArray(payload.cards) ? payload.cards : []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Gift cards could not be loaded');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div role="status" className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-sm text-gray-300">Loading gift cards…</div>;
  if (error) return <div role="alert" className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-100"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); void load(); }} className="mt-4 rounded-md border border-red-700 px-3 py-2 hover:border-red-500">Try again</button></div>;
  if (cards.length === 0) return <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-6"><h2 className="font-semibold">No purchased gift cards</h2><p className="mt-2 text-sm text-gray-400">Gift cards you purchase will appear here. For safety, gift codes are only delivered to their recipient.</p></div>;
  return <div className="space-y-4">{cards.map((card, index) => <article key={`${card.createdAt}-${index}`} className="rounded-lg border border-neutral-700 bg-neutral-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">Gift card purchase</h2><p className="mt-1 text-sm text-gray-400">Purchased {new Date(card.createdAt * 1000).toLocaleDateString()}</p></div><span className="rounded-full border border-neutral-600 px-3 py-1 text-xs text-gray-200">{card.status === 'active' ? 'Active' : 'Disabled'}</span></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Issued value</dt><dd className="mt-1 text-lg text-white">{formatMoney(card.issuedAmount)}</dd></div><div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Available balance</dt><dd className="mt-1 text-lg text-white">{formatMoney(card.availableBalance)}</dd></div></dl>{deliveryLabel(card.delivery) && <p className="mt-4 text-sm text-gray-400">{deliveryLabel(card.delivery)}</p>}</article>)}</div>;
}
