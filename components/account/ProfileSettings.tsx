"use client";

import { useState } from "react";

export function ProfileSettings({ firstName: initialFirst, lastName: initialLast }: { firstName: string; lastName: string }) {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ first_name: firstName, last_name: lastName }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Settings could not be saved");
      setMessage("Settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Settings could not be saved"); }
    finally { setBusy(false); }
  }
  const input = "w-full rounded-md border border-neutral-600 bg-neutral-950 px-3 py-2 text-white";
  return <form onSubmit={submit} className="max-w-xl space-y-4 rounded-lg border border-neutral-700 bg-neutral-900 p-5">
    <label className="block text-sm text-gray-300">First name<input className={`${input} mt-1`} maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
    <label className="block text-sm text-gray-300">Last name<input className={`${input} mt-1`} maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
    <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 font-medium text-black">{busy ? "Saving…" : "Save settings"}</button>
    {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
  </form>;
}
