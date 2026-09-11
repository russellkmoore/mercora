"use client";

import { useEffect, useState } from "react";
import type { SavedPaymentMethod } from "@/app/api/account/payment-methods/route";

function brandLabel(brand: string) {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function expiryLabel(method: SavedPaymentMethod) {
  return `${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).padStart(4, "0")}`;
}

export function PaymentMethodList() {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  // IN-02: per-row, not a single global boolean — removing card A must not
  // disable card B's Remove button too (that reads as a stall on an
  // unrelated row). Also doubles as the same-row double-submit guard the
  // single boolean used to provide.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/account/payment-methods", { credentials: "same-origin" });
        const body = (await response.json()) as { paymentMethods?: SavedPaymentMethod[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Saved cards could not be loaded");
        if (!cancelled) setMethods(body.paymentMethods ?? []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Saved cards could not be loaded");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(method: SavedPaymentMethod) {
    if (busyIds.has(method.id)) return;
    const confirmed = window.confirm(`Remove ${brandLabel(method.brand)} ending in ${method.last4}?`);
    if (!confirmed) return;
    setBusyIds((current) => new Set(current).add(method.id));
    setMessage("");
    try {
      const response = await fetch(`/api/account/payment-methods/${encodeURIComponent(method.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Card could not be removed");
      setMethods((current) => current.filter((entry) => entry.id !== method.id));
      setMessage("Card removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Card could not be removed");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(method.id);
        return next;
      });
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your saved cards…</p>;
  }

  if (methods.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No cards are saved yet. Choosing to save a card at checkout will add it here.
        </p>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {methods.map((method) => (
          <article key={method.id} className="rounded-lg border border-border bg-surface-elevated p-4">
            <h2 className="font-semibold text-foreground">
              {brandLabel(method.brand)} ending in {method.last4}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Expires {expiryLabel(method)}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <button
                type="button"
                disabled={busyIds.has(method.id)}
                className="text-danger"
                onClick={() => void remove(method)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
