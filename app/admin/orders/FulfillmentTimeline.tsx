"use client";

import { AlertTriangle, CheckCircle, History, Info, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatTimeline, type FulfillmentEvent } from "./queue-model";

interface FulfillmentTimelineProps {
  events: FulfillmentEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function FulfillmentTimeline({ events, loading, error, onRetry }: FulfillmentTimelineProps) {
  const entries = formatTimeline(events);
  return (
    <Card className="admin-card p-6">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-text-primary">
        <History className="mr-2 h-5 w-5" />Fulfillment history
      </h3>
      {loading ? (
        <p role="status" className="flex items-center text-sm text-text-secondary"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading history…</p>
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-state-error">
          <AlertTriangle className="h-4 w-4" /><span>{error}</span>
          <button type="button" className="underline" onClick={onRetry}>Try again</button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-muted">No fulfillment actions have been recorded.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border-l-4 border-border-default bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center font-medium text-text-primary">
                  {entry.tone === "error" ? <AlertTriangle className="mr-2 h-4 w-4 text-state-error" /> : entry.tone === "success" ? <CheckCircle className="mr-2 h-4 w-4 text-state-success" /> : <Info className="mr-2 h-4 w-4 text-state-info" />}
                  {entry.title}
                </span>
                <time dateTime={entry.timestamp} className="text-xs text-text-secondary">{new Date(entry.timestamp).toLocaleString()}</time>
              </div>
              {entry.details.length > 0 && <ul className="mt-2 space-y-1 text-sm text-text-secondary">{entry.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
              <p className="mt-2 text-xs text-text-muted">By {entry.actor}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
