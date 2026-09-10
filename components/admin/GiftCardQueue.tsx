'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Money, type MachMoney } from '@/lib/money';
import { maskGiftCardCodeSuffix } from '@/lib/gift-cards/code';
import CreateGiftCardDialog from './gift-cards/CreateGiftCardDialog';

interface AdminGiftCard {
  id: string;
  codeSuffix?: string;
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: 'active' | 'disabled';
  createdAt: number;
  issuedOrderId?: string;
  issuedLineId?: string;
  recipientEmail?: string;
  purchaser?: string;
  /** WR-09: set for a card issued by reissue — the card it replaced. */
  reissuedFromGiftCardId?: string;
  delivery?: { status: 'pending' | 'processing' | 'sent' | 'needs_review'; attempts: number };
}

interface QueueResponse {
  cards?: AdminGiftCard[];
  meta?: { limit: number; offset: number; total: number };
  error?: string;
}

const PAGE_SIZE = 25;

function money(value: MachMoney) { return Money.fromMajor(value.amount, value.currency).format(); }

/**
 * Who is behind this card. Provenance comes from the record (the customer,
 * an `admin_created` event, a `reissued_from` event) — never inferred, so an
 * unresolved label renders "—" rather than asserting something (WR-09).
 */
function PurchaserCell({ card }: { card: AdminGiftCard }) {
  if (card.reissuedFromGiftCardId) {
    return (
      <>
        Reissued from{' '}
        <Link href={`/admin/gift-cards/${encodeURIComponent(card.reissuedFromGiftCardId)}`} className="text-orange-400 hover:underline">
          {card.reissuedFromGiftCardId}
        </Link>
      </>
    );
  }
  return <>{card.purchaser ?? '—'}</>;
}

function deliveryLabel(card: AdminGiftCard): string {
  if (!card.delivery) return 'Not queued';
  return `${card.delivery.status}${card.delivery.attempts ? ` (${card.delivery.attempts} attempts)` : ''}`;
}

export default function GiftCardQueue() {
  const [cards, setCards] = useState<AdminGiftCard[]>([]);
  const [meta, setMeta] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRequestId, setCreateRequestId] = useState('');

  // D-15: one parameterised loader — mount, search, filter and paging all
  // call this, instead of the duplicated fetch-in-useEffect-and-in-callback
  // the previous version had.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (query) params.set('q', query);
      const response = await fetch(`/api/admin/gift-cards?${params.toString()}`);
      const payload = await response.json() as QueueResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Gift cards could not be loaded');
      setCards(Array.isArray(payload.cards) ? payload.cards : []);
      setMeta(payload.meta ?? { limit: PAGE_SIZE, offset, total: 0 });
    } catch (cause) {
      setCards([]);
      setError(cause instanceof Error ? cause.message : 'Gift cards could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [offset, query, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const openCreateDialog = () => {
    setCreateRequestId(crypto.randomUUID());
    setCreateOpen(true);
  };

  const from = meta.total === 0 ? 0 : meta.offset + 1;
  const to = Math.min(meta.offset + meta.limit, meta.total);

  return (
    <div className="space-y-4">
      <Card className="admin-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => { event.preventDefault(); setQuery(searchDraft.trim()); setOffset(0); }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                aria-label="Search gift cards"
                value={searchDraft}
                maxLength={254}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Order id, recipient email, or code suffix"
                className="admin-input w-80 pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">Search</Button>
            {query && (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchDraft(''); setQuery(''); setOffset(0); }}>
                Clear
              </Button>
            )}
            <select
              aria-label="Filter by status"
              className="admin-input rounded-md border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value as 'all' | 'active' | 'disabled'); setOffset(0); }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </form>
          <Button size="sm" onClick={openCreateDialog}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create card
          </Button>
        </div>
      </Card>

      {loading ? (
        <div role="status" className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-sm text-gray-300">Loading gift cards…</div>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-100">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-4 rounded-md border border-red-700 px-3 py-2 hover:border-red-500">Try again</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-700">
          <table className="w-full min-w-270 text-left text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-4">Code</th>
                <th className="p-4">Issued</th>
                <th className="p-4">Available</th>
                <th className="p-4">Status</th>
                <th className="p-4">Purchaser</th>
                <th className="p-4">Recipient</th>
                <th className="p-4">Order</th>
                <th className="p-4">Delivery</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-t border-neutral-800 text-gray-200 hover:bg-neutral-900/60">
                  <td className="p-4 font-mono">
                    <Link href={`/admin/gift-cards/${card.id}`} className="text-orange-400 hover:underline">
                      {maskGiftCardCodeSuffix(card.codeSuffix ?? null) ?? '—'}
                    </Link>
                  </td>
                  <td className="p-4">{money(card.issuedAmount)}</td>
                  <td className="p-4">{money(card.availableBalance)}</td>
                  <td className="p-4">{card.status}</td>
                  <td className="p-4"><PurchaserCell card={card} /></td>
                  <td className="p-4 text-gray-400">{card.recipientEmail ?? '—'}</td>
                  <td className="p-4 text-gray-400">{card.issuedOrderId ?? '—'}</td>
                  <td className="p-4">{deliveryLabel(card)}</td>
                  <td className="p-4 text-gray-400">{new Date(card.createdAt * 1_000).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cards.length === 0 && <p className="p-6 text-sm text-gray-400">No gift cards match this queue.</p>}
        </div>
      )}

      {meta.total > meta.limit && (
        <nav aria-label="Gift card pages" className="flex items-center justify-between rounded-lg border border-neutral-700 p-4">
          <span className="text-sm text-gray-400">Showing {from} to {to} of {meta.total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <Button size="sm" variant="ghost" disabled={offset + PAGE_SIZE >= meta.total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}

      {createOpen && (
        <CreateGiftCardDialog
          requestId={createRequestId}
          onCancel={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
