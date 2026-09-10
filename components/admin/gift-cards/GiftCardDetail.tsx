"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money, type MachMoney } from "@/lib/money";
import { maskGiftCardCodeSuffix } from "@/lib/gift-cards/code";
import GiftCardTimeline, { type GiftCardTimelineEntry } from "./GiftCardTimeline";

export interface GiftCardDetailCard {
  id: string;
  maskedCode: string | null;
  codeSuffix: string | null;
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: "active" | "disabled";
  createdAt: number;
  disabledAt: number | null;
  issuedOrderId: string | null;
  recipientEmail: string | null;
  purchaser: string | null;
  delivery: { status: "pending" | "processing" | "sent" | "needs_review"; attempts: number } | null;
}

export type GiftCardReservationClassification =
  | "open"
  | "committed_unsettled"
  | "released"
  | "expired"
  | "settled";

export interface GiftCardReservationView {
  id: string;
  amountMinor: number;
  reservedAt: number;
  expiresAt: number;
  committedOrderId: string | null;
  committedAt: number | null;
  releasedAt: number | null;
  releaseReason: string | null;
  classification: GiftCardReservationClassification;
}

interface GiftCardDetailResponse {
  card?: GiftCardDetailCard;
  reservations?: GiftCardReservationView[];
  capabilities?: { codeRevealEnabled: boolean };
  error?: string;
}

interface GiftCardEventsResponse {
  events?: GiftCardTimelineEntry[];
  error?: string;
}

function money(value: MachMoney) { return Money.fromMajor(value.amount, value.currency).format(); }

function formatDate(epochSeconds: number | null): string {
  return epochSeconds ? new Date(epochSeconds * 1_000).toLocaleString() : "—";
}

export default function GiftCardDetail({ giftCardId }: { giftCardId: string }) {
  const [card, setCard] = useState<GiftCardDetailCard | null>(null);
  const [events, setEvents] = useState<GiftCardTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cardResponse, eventsResponse] = await Promise.all([
        fetch(`/api/admin/gift-cards/${encodeURIComponent(giftCardId)}`),
        fetch(`/api/admin/gift-cards/${encodeURIComponent(giftCardId)}/events`),
      ]);
      const cardPayload = await cardResponse.json() as GiftCardDetailResponse;
      if (!cardResponse.ok || !cardPayload.card) {
        throw new Error(cardPayload.error ?? "Gift card could not be loaded");
      }
      const eventsPayload = await eventsResponse.json() as GiftCardEventsResponse;
      if (!eventsResponse.ok) {
        throw new Error(eventsPayload.error ?? "Gift-card history could not be loaded");
      }
      setCard(cardPayload.card);
      setEvents(eventsPayload.events ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gift card could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [giftCardId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div role="status" className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-sm text-gray-300">Loading gift card…</div>;
  }

  if (error || !card) {
    return (
      <div role="alert" className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-100">
        <p>{error || "Gift card could not be loaded"}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-md border border-red-700 px-3 py-2 hover:border-red-500">Try again</button>
      </div>
    );
  }

  const maskedCode = maskGiftCardCodeSuffix(card.codeSuffix) ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/gift-cards" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to gift cards
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="admin-card space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Gift card</p>
            <p className="mt-1 font-mono text-lg text-white">{maskedCode}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              card.status === "active" ? "bg-green-900/40 text-green-300" : "bg-neutral-800 text-gray-400"
            }`}
          >
            {card.status === "active" ? "Active" : "Disabled"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-gray-500">Issued amount</p>
            <p className="text-white">{money(card.issuedAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Available balance</p>
            <p className="text-white">{money(card.availableBalance)}</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="text-white">{formatDate(card.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Disabled</p>
            <p className="text-white">{formatDate(card.disabledAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Recipient email</p>
            <p className="text-white">{card.recipientEmail ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Purchaser</p>
            <p className="text-white">{card.purchaser ?? (card.issuedOrderId ? "—" : "Admin created")}</p>
          </div>
          <div>
            <p className="text-gray-500">Issuing order</p>
            <p className="text-white">
              {card.issuedOrderId ? (
                <Link className="text-orange-400 hover:underline" href={`/admin/orders/${card.issuedOrderId}`}>
                  {card.issuedOrderId}
                </Link>
              ) : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Delivery</p>
            <p className="text-white">
              {card.delivery
                ? `${card.delivery.status}${card.delivery.attempts ? ` (${card.delivery.attempts} attempts)` : ""}`
                : "Not queued"}
            </p>
          </div>
        </div>
      </Card>

      <GiftCardTimeline entries={events} />
    </div>
  );
}
