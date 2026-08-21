'use client';

import { useCallback, useEffect, useState } from 'react';
import { Money, type MachMoney } from '@/lib/money';

interface AdminGiftCard {
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: 'active' | 'disabled';
  createdAt: number;
  issuedOrderId?: string;
  issuedLineId?: string;
  delivery?: { status: 'pending' | 'processing' | 'sent' | 'needs_review'; attempts: number };
}

function money(value: MachMoney) { return Money.fromMajor(value.amount, value.currency).format(); }

export default function GiftCardQueue() {
  const [cards, setCards] = useState<AdminGiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/gift-cards');
      const payload = await response.json() as { cards?: AdminGiftCard[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Gift cards could not be loaded');
      setCards(Array.isArray(payload.cards) ? payload.cards : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gift cards could not be loaded');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/gift-cards')
      .then(async (response) => {
        const payload = await response.json() as { cards?: AdminGiftCard[]; error?: string };
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
  return <div className="overflow-x-auto rounded-lg border border-neutral-700"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-neutral-900 text-xs uppercase tracking-wide text-gray-500"><tr><th className="p-4">Issued</th><th className="p-4">Available</th><th className="p-4">Status</th><th className="p-4">Delivery</th><th className="p-4">Order reference</th></tr></thead><tbody>{cards.map((card, index) => <tr key={`${card.createdAt}-${index}`} className="border-t border-neutral-800 text-gray-200"><td className="p-4">{money(card.issuedAmount)}</td><td className="p-4">{money(card.availableBalance)}</td><td className="p-4">{card.status}</td><td className="p-4">{card.delivery ? `${card.delivery.status}${card.delivery.attempts ? ` (${card.delivery.attempts} attempts)` : ''}` : 'Not queued'}</td><td className="p-4 text-gray-400">{card.issuedOrderId ?? '—'}</td></tr>)}</tbody></table>{cards.length === 0 && <p className="p-6 text-sm text-gray-400">No gift cards match this queue.</p>}</div>;
}
