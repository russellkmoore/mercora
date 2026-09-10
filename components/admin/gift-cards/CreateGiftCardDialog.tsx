"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, PlusCircle, RefreshCw } from "lucide-react";
import { validateGiftCardRecipientEmail } from "@/lib/gift-cards/customization";

interface CreateGiftCardDialogProps {
  /** D-07/T-14-56: minted once when the dialog opens, reused on every retry of this submission. */
  requestId: string;
  onCancel: () => void;
  onCreated: () => void;
}

/**
 * D-07/D-22: an admin-created card, confirmed by a required reason. The
 * `requestId` prop is minted once per dialog-open by the parent and posted
 * unchanged on every retry, so a double-click cannot mint two cards — the
 * server-side idempotent id derivation is the real backstop.
 */
export default function CreateGiftCardDialog({ requestId, onCancel, onCreated }: CreateGiftCardDialogProps) {
  const [amount, setAmount] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedMinor = Math.round(Number(amount) * 100);
  const amountValid = amount.trim().length > 0 && Number.isFinite(parsedMinor) && parsedMinor > 0;
  const emailValid = recipientEmail.trim().length > 0 && validateGiftCardRecipientEmail(recipientEmail.trim()) === null;
  const reasonValid = reason.trim().length > 0 && reason.trim().length <= 500;
  const canSubmit = amountValid && emailValid && reasonValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: parsedMinor,
          recipientEmail: recipientEmail.trim(),
          ...(recipientName.trim() ? { recipientName: recipientName.trim() } : {}),
          reason: reason.trim(),
          requestId,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; giftCardId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to create gift card");
      toast.success("Gift card created");
      onCreated();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to create gift card";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a gift card</DialogTitle>
          <DialogDescription>
            Issued immediately and delivered by the same email queue as a purchased card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="gift-card-amount" className="mb-2 block">Amount</Label>
            <Input
              id="gift-card-amount"
              className="admin-input"
              inputMode="decimal"
              placeholder="25.00"
              value={amount}
              disabled={busy}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gift-card-recipient-email" className="mb-2 block">Recipient email</Label>
            <Input
              id="gift-card-recipient-email"
              type="email"
              className="admin-input"
              value={recipientEmail}
              disabled={busy}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gift-card-recipient-name" className="mb-2 block">Recipient name (optional)</Label>
            <Input
              id="gift-card-recipient-name"
              className="admin-input"
              value={recipientName}
              disabled={busy}
              onChange={(event) => setRecipientName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gift-card-reason" className="mb-2 block">Reason</Label>
            <Textarea
              id="gift-card-reason"
              className="admin-input"
              rows={3}
              maxLength={500}
              placeholder="Why this card is being created…"
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Create card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
