"use client";

import { useState } from "react";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";
import { type AddressFormState, emptyAddressForm, saveAddress } from "@/lib/account/address-client";

type FormMessage = { kind: "error" | "success"; text: string } | null;

export function AddressForm(props: {
  initial?: Partial<AddressFormState>;
  mode: "create" | "edit";
  addressId?: string;
  onSaved: (address: MACHCustomerAddress) => void;
  onCancel?: () => void;
  lockType?: "shipping" | "billing";
  submitLabel?: string;
}) {
  const [form, setForm] = useState<AddressFormState>({
    ...emptyAddressForm,
    ...props.initial,
    ...(props.lockType ? { type: props.lockType } : {}),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  const input = "w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { address } = await saveAddress(form, props.addressId);
      props.onSaved(address);
      if (props.mode !== "edit") {
        setForm({ ...emptyAddressForm, ...(props.lockType ? { type: props.lockType } : {}) });
      }
      setMessage({ kind: "success", text: "Address saved." });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Address could not be saved",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          name="label"
          className={input}
          maxLength={80}
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        {props.lockType ? null : (
          <select
            name="type"
            className={input}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AddressFormState["type"] })}
          >
            <option value="shipping">Shipping</option>
            <option value="billing">Billing</option>
          </select>
        )}
        <input
          name="line1"
          className={input}
          required
          maxLength={200}
          placeholder="Address line 1"
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
        />
        <input
          name="line2"
          className={input}
          maxLength={200}
          placeholder="Address line 2"
          value={form.line2}
          onChange={(e) => setForm({ ...form, line2: e.target.value })}
        />
        <input
          name="city"
          className={input}
          required
          maxLength={200}
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <input
          name="region"
          className={input}
          maxLength={200}
          placeholder="Region"
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
        />
        <input
          name="postal_code"
          className={input}
          maxLength={32}
          placeholder="Postal code"
          value={form.postal_code}
          onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
        />
        <input
          name="country"
          className={input}
          required
          maxLength={2}
          pattern="[A-Za-z]{2}"
          aria-label="Two-letter country code"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
        />
      </div>
      <label className="flex gap-2 text-sm text-muted-foreground">
        <input
          name="is_default"
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
        />
        Use as default
      </label>
      <div className="flex gap-3">
        <button disabled={busy} className="rounded-md bg-primary px-4 py-2 font-medium text-on-primary">
          {busy ? "Saving…" : props.submitLabel ?? "Save"}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel} className="text-muted-foreground">
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-sm text-danger" : "text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
