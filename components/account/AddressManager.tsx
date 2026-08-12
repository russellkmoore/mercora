"use client";

import { useState } from "react";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";

type FormState = {
  label: string; type: "shipping" | "billing"; line1: string; line2: string;
  city: string; region: string; postal_code: string; country: string; is_default: boolean;
};

const empty: FormState = {
  label: "", type: "shipping", line1: "", line2: "", city: "", region: "",
  postal_code: "", country: "US", is_default: false,
};

function toForm(value: MACHCustomerAddress): FormState {
  return {
    label: value.label ?? "", type: value.type === "billing" ? "billing" : "shipping",
    line1: String(value.address.line1 ?? ""), line2: String(value.address.line2 ?? ""),
    city: String(value.address.city ?? ""), region: value.address.region ?? "",
    postal_code: value.address.postal_code ?? "", country: value.address.country,
    is_default: value.is_default === true,
  };
}

export function AddressManager({ initial }: { initial: MACHCustomerAddress[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch(editing ? `/api/account/addresses/${editing}` : "/api/account/addresses", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { address?: MACHCustomerAddress; error?: string };
      if (!response.ok || !body.address) throw new Error(body.error || "Address could not be saved");
      setAddresses((current) => {
        const reset = body.address!.is_default
          ? current.map((entry) => ({ ...entry, is_default: false }))
          : current;
        return editing
          ? reset.map((entry) => entry.id === editing ? body.address! : entry)
          : [...reset, body.address!];
      });
      setForm(empty); setEditing(null); setMessage("Address saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Address could not be saved");
    } finally { setBusy(false); }
  }

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

  const input = "w-full rounded-md border border-neutral-600 bg-neutral-950 px-3 py-2 text-white";
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((entry) => (
          <article key={entry.id} className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
            <h2 className="font-semibold text-white">{entry.label || (entry.type === "billing" ? "Billing address" : "Shipping address")}{entry.is_default ? " · Default" : ""}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-300">{[entry.address.line1, entry.address.line2, `${entry.address.city}, ${entry.address.region ?? ""} ${entry.address.postal_code ?? ""}`, entry.address.country].filter(Boolean).join("\n")}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <button type="button" disabled={busy} className="text-orange-400" onClick={() => { setEditing(entry.id ?? null); setForm(toForm(entry)); }}>Edit</button>
              {entry.id && <button type="button" disabled={busy} className="text-red-400" onClick={() => void remove(entry.id!)}>Remove</button>}
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={save} className="space-y-4 rounded-lg border border-neutral-700 bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-white">{editing ? "Edit address" : "Add an address"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={input} maxLength={80} placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState["type"] })}><option value="shipping">Shipping</option><option value="billing">Billing</option></select>
          <input className={input} required maxLength={200} placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          <input className={input} maxLength={200} placeholder="Address line 2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          <input className={input} required maxLength={200} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className={input} maxLength={200} placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          <input className={input} maxLength={32} placeholder="Postal code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          <input className={input} required maxLength={2} pattern="[A-Za-z]{2}" aria-label="Two-letter country code" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
        </div>
        <label className="flex gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />Use as default</label>
        <div className="flex gap-3"><button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 font-medium text-black">{busy ? "Saving…" : "Save"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }} className="text-gray-300">Cancel</button>}</div>
        {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
      </form>
    </div>
  );
}
