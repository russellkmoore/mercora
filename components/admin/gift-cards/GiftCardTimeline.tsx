import { Card } from "@/components/ui/card";

export type GiftCardTimelineActorType = "admin" | "service" | "system";

export interface GiftCardTimelineEntry {
  id: string;
  type: string;
  actorType: GiftCardTimelineActorType;
  actorId: string | null;
  actorLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Plain-words labels for every entry type the timeline API can return
 * (D-04). Kept in the words an operator would use, not the underlying table
 * or column name.
 */
const ENTRY_LABELS: Record<string, string> = {
  issuance: "Card issued",
  redemption: "Redeemed",
  refund: "Refunded back to the card",
  adjustment: "Balance adjusted",
  hold: "Hold placed",
  awaiting_settlement: "Awaiting settlement",
  released: "Hold released",
  delivery_created: "Delivery queued",
  delivery_sent: "Delivery sent",
  delivery_needs_review: "Delivery needs review",
  note: "Note added",
  disabled: "Card disabled",
  reissued: "Reissued as a new card",
  reissued_from: "Issued to replace a disabled card",
  delivery_resent: "Delivery re-sent",
  delivery_requeued: "Delivery re-queued",
  hold_released: "Hold released",
  admin_created: "Created by an admin",
  code_revealed: "Code revealed",
};

function labelFor(type: string): string {
  return ENTRY_LABELS[type] ?? type.replace(/_/g, " ");
}

function actorLabel(entry: GiftCardTimelineEntry): string {
  if (entry.actorLabel) return entry.actorLabel;
  switch (entry.actorType) {
    case "admin":
      return "an admin";
    case "service":
      return "a service";
    default:
      return "system";
  }
}

const DETAIL_FIELD_LABELS: Record<string, string> = {
  amountMinor: "Amount",
  orderId: "Order",
  reason: "Reason",
  text: "Note",
  to: "Sent to",
  to_gift_card_id: "New card",
  from_gift_card_id: "Original card",
  amount_minor: "Amount",
  recipient_email: "Recipient",
  reservation_id: "Reservation",
  delivery_id: "Delivery",
  status: "Status",
};

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if ((key === "amountMinor" || key === "amount_minor") && typeof value === "number") {
    return (value / 100).toFixed(2);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function DetailFields({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const entries = Object.entries(details).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-gray-400 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="shrink-0 text-gray-500">{DETAIL_FIELD_LABELS[key] ?? key}:</dt>
          <dd className="text-gray-300">{formatDetailValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * D-04: the merged, oldest-first "what happened to this card" list. Purely
 * presentational — the merge/sort/label-resolution logic lives server-side
 * in `lib/gift-cards/timeline.ts`.
 */
export default function GiftCardTimeline({ entries }: { entries: GiftCardTimelineEntry[] }) {
  return (
    <Card className="admin-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No history yet.</p>
      ) : (
        <ol className="space-y-4 border-l border-neutral-700 pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-neutral-600 bg-neutral-900" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-white">{labelFor(entry.type)}</p>
                <time className="text-xs text-gray-500" dateTime={new Date(entry.createdAt * 1_000).toISOString()}>
                  {new Date(entry.createdAt * 1_000).toLocaleString()}
                </time>
              </div>
              <p className="text-xs text-gray-500">By {actorLabel(entry)}</p>
              <DetailFields details={entry.details} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
