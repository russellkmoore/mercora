"use client";

import { useState } from "react";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";
import { AddressForm } from "@/components/account/AddressForm";
import { addressFormFrom } from "@/lib/account/address-client";

export function AddressManager({ initial }: { initial: MACHCustomerAddress[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Address could not be removed");
      setAddresses((current) => current.filter((entry) => entry.id !== id));
      setMessage("Address removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Address could not be removed");
    } finally { setBusy(false); }
  }

  function handleSaved(address: MACHCustomerAddress) {
    setAddresses((current) => {
      const reset = address.is_default
        ? current.map((entry) => ({ ...entry, is_default: false }))
        : current;
      return editing
        ? reset.map((entry) => (entry.id === editing ? address : entry))
        : [...reset, address];
    });
    setEditing(null);
  }

  const entryBeingEdited = editing ? addresses.find((entry) => entry.id === editing) : undefined;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((entry) => (
          <article key={entry.id} className="rounded-lg border border-border bg-surface-elevated p-4">
            <h2 className="font-semibold text-foreground">{entry.label || (entry.type === "billing" ? "Billing address" : "Shipping address")}{entry.is_default ? " · Default" : ""}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{[entry.address.line1, entry.address.line2, `${entry.address.city}, ${entry.address.region ?? ""} ${entry.address.postal_code ?? ""}`, entry.address.country].filter(Boolean).join("\n")}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <button type="button" disabled={busy} className="text-primary" onClick={() => setEditing(entry.id ?? null)}>Edit</button>
              {entry.id && <button type="button" disabled={busy} className="text-danger" onClick={() => void remove(entry.id!)}>Remove</button>}
            </div>
          </article>
        ))}
      </div>
      <div className="space-y-4 rounded-lg border border-border bg-surface-elevated p-5">
        <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit address" : "Add an address"}</h2>
        <AddressForm
          key={editing ?? "create"}
          mode={editing ? "edit" : "create"}
          addressId={editing ?? undefined}
          initial={editing && entryBeingEdited ? addressFormFrom(entryBeingEdited) : undefined}
          submitLabel={editing ? "Save changes" : "Save"}
          onSaved={handleSaved}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
