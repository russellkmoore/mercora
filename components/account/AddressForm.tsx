"use client";

import { useState } from "react";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";
import { type AddressFormState, emptyAddressForm, saveAddress } from "@/lib/account/address-client";

type FormMessage = { kind: "error" | "success"; text: string } | null;

export function AddressForm(props: {
  /** Seeds state on mount only; re-key the element to change it (as `AddressManager` does). */
  initial?: Partial<AddressFormState>;
  mode: "create" | "edit";
  addressId?: string;
  /** Called after the save succeeds; a returned promise is not awaited or observed. */
  onSaved: (address: MACHCustomerAddress) => void | Promise<void>;
  /**
   * Hand feedback to the parent. When set, the form renders no message of its
   * own: failures arrive here, success is implied by `onSaved`. Leave unset to
   * keep the inline `role="alert"` / `role="status"` message.
   */
  onError?: (message: string) => void;
  /** Mirrors the form's busy flag so a parent can lock its own controls during a save. */
  onBusyChange?: (busy: boolean) => void;
  onCancel?: () => void;
  /** Forces `type` and hides its select. Read on mount only; re-key the element to change it. */
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
  const inlineFeedback = props.onError === undefined;

  const input = "w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    props.onBusyChange?.(true);
    setMessage(null);
    let address: MACHCustomerAddress;
    try {
      ({ address } = await saveAddress(form, props.addressId));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Address could not be saved";
      if (props.onError) props.onError(text);
      else setMessage({ kind: "error", text });
      return;
    } finally {
      setBusy(false);
      props.onBusyChange?.(false);
    }
    if (props.mode !== "edit") {
      setForm({ ...emptyAddressForm, ...(props.lockType ? { type: props.lockType } : {}) });
    }
    if (inlineFeedback) setMessage({ kind: "success", text: "Address saved." });
    // Outside the try: a consumer error must never be reported as a failed save.
    void props.onSaved(address);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          name="label"
          className={input}
          maxLength={80}
          placeholder="Label"
          aria-label="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        {props.lockType ? null : (
          <select
            name="type"
            aria-label="Address type"
            className={input}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value === "billing" ? "billing" : "shipping" })}
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
          aria-label="Address line 1"
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
        />
        <input
          name="line2"
          className={input}
          maxLength={200}
          placeholder="Address line 2"
          aria-label="Address line 2"
          value={form.line2}
          onChange={(e) => setForm({ ...form, line2: e.target.value })}
        />
        <input
          name="city"
          className={input}
          required
          maxLength={200}
          placeholder="City"
          aria-label="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <input
          name="region"
          className={input}
          maxLength={200}
          placeholder="Region"
          aria-label="Region"
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
        />
        <input
          name="postal_code"
          className={input}
          maxLength={32}
          placeholder="Postal code"
          aria-label="Postal code"
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
      {message && message.kind === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message.text}
        </p>
      )}
      {message && message.kind === "success" && (
        <p role="status" className="text-sm text-muted-foreground">
          {message.text}
        </p>
      )}
    </form>
  );
}
