"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Money } from "@/lib/money";
import type { GiftCardDetailCard, GiftCardReservationView } from "./GiftCardDetail";

type PendingAction =
  | { type: "disable" }
  | { type: "reissue" }
  | { type: "resend" }
  | { type: "requeue" }
  | { type: "release"; reservation: GiftCardReservationView }
  | { type: "reveal" };

interface GiftCardActionBarProps {
  giftCardId: string;
  card: GiftCardDetailCard;
  reservations: GiftCardReservationView[];
  capabilities: { codeRevealEnabled: boolean };
  onChanged: () => void;
}

/**
 * D-17/D-22: one button per action available on this card, an `AlertDialog`
 * confirm for every consequential action and a `Dialog` for the two that
 * take optional input (resend, and the note form beside this component) —
 * never a native browser confirm. Every outcome is a `sonner` toast, and a success
 * refreshes the card and its timeline via `onChanged` so the audit entry the
 * admin just created is visible immediately.
 */
export default function GiftCardActionBar({
  giftCardId,
  card,
  reservations,
  capabilities,
  onChanged,
}: GiftCardActionBarProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [reissueTo, setReissueTo] = useState("");
  const [resendTo, setResendTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);

  const closeDialog = () => {
    if (busy) return;
    setPending(null);
    setDisableReason("");
    setReissueTo("");
    setResendTo("");
    // T-14-54: the code lives only for the lifetime of this open dialog.
    setRevealedCode(null);
  };

  const post = async (path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await fetch(`/api/admin/gift-cards/${encodeURIComponent(giftCardId)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
    return payload;
  };

  const runDisable = async () => {
    setBusy(true);
    try {
      await post("disable", { reason: disableReason.trim() });
      toast.success("Gift card disabled");
      closeDialog();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to disable gift card");
    } finally {
      setBusy(false);
    }
  };

  const runReissue = async () => {
    setBusy(true);
    try {
      await post("reissue", reissueTo.trim() ? { to: reissueTo.trim() } : {});
      toast.success("Balance reissued to a new card");
      closeDialog();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to reissue gift card");
    } finally {
      setBusy(false);
    }
  };

  const runResend = async () => {
    setBusy(true);
    try {
      await post("resend", resendTo.trim() ? { to: resendTo.trim() } : {});
      toast.success("Delivery email re-sent");
      closeDialog();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to resend gift-card delivery");
    } finally {
      setBusy(false);
    }
  };

  const runRequeue = async () => {
    setBusy(true);
    try {
      await post("requeue", {});
      toast.success("Delivery re-queued");
      closeDialog();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to re-queue delivery");
    } finally {
      setBusy(false);
    }
  };

  const runRelease = async (reservationId: string) => {
    setBusy(true);
    try {
      await post("release-hold", { reservationId });
      toast.success("Hold released");
      closeDialog();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to release hold");
    } finally {
      setBusy(false);
    }
  };

  const runReveal = async () => {
    setBusy(true);
    try {
      const payload = await post("reveal", { confirm: true });
      const code = typeof payload.code === "string" ? payload.code : null;
      if (!code) throw new Error("Gift-card code is unavailable");
      setRevealedCode(code);
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to reveal gift-card code");
    } finally {
      setBusy(false);
    }
  };

  const openReservations = reservations.filter((reservation) => reservation.classification === "open");
  const awaitingSettlement = reservations.filter((reservation) => reservation.classification === "committed_unsettled");

  const canDisable = card.status === "active";
  const canReissue = card.status === "disabled";
  const canResend = card.delivery?.status === "sent" || card.delivery?.status === "needs_review";
  const canRequeue = card.delivery?.status === "needs_review";
  // D-12: the control's presence and the reveal route's own gate read the
  // same stored setting, via the detail response's `capabilities`.
  const canReveal = capabilities.codeRevealEnabled;

  const availableBalanceLabel = Money.fromMajor(card.availableBalance.amount, card.availableBalance.currency).format();

  return (
    <div className="space-y-4">
      {(canDisable || canReissue || canResend || canRequeue || canReveal) && (
        <div className="flex flex-wrap gap-2">
          {canDisable && (
            <Button variant="outline" size="sm" onClick={() => setPending({ type: "disable" })}>Disable</Button>
          )}
          {canReissue && (
            <Button variant="outline" size="sm" onClick={() => setPending({ type: "reissue" })}>Reissue</Button>
          )}
          {canResend && (
            <Button variant="outline" size="sm" onClick={() => setPending({ type: "resend" })}>Resend delivery</Button>
          )}
          {canRequeue && (
            <Button variant="outline" size="sm" onClick={() => setPending({ type: "requeue" })}>Re-queue delivery</Button>
          )}
          {canReveal && (
            <Button variant="outline" size="sm" onClick={() => setPending({ type: "reveal" })}>Reveal code</Button>
          )}
        </div>
      )}

      {(openReservations.length > 0 || awaitingSettlement.length > 0) && (
        <div className="space-y-2 rounded-lg border border-neutral-700 p-4">
          <h3 className="text-sm font-semibold text-white">Reservations</h3>
          {openReservations.map((reservation) => (
            <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-300">
              <span>
                Hold of {Money.fromMinor(reservation.amountMinor, card.availableBalance.currency).format()}
                {" — held since "}{new Date(reservation.reservedAt * 1_000).toLocaleString()}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPending({ type: "release", reservation })}>
                Release hold
              </Button>
            </div>
          ))}
          {awaitingSettlement.map((reservation) => (
            <div key={reservation.id} className="text-sm text-gray-500">
              Hold of {Money.fromMinor(reservation.amountMinor, card.availableBalance.currency).format()} — awaiting settlement
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={pending?.type === "disable"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this card</AlertDialogTitle>
            <AlertDialogDescription>
              Redemption stops immediately and the ledger is preserved — there is no undo. The answer to a mistaken disable is a reissue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="gift-card-disable-reason">Reason</Label>
            <Textarea
              id="gift-card-disable-reason"
              rows={3}
              maxLength={500}
              value={disableReason}
              disabled={busy}
              onChange={(event) => setDisableReason(event.target.value)}
              placeholder="Why this card is being disabled…"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !disableReason.trim()} onClick={() => void runDisable()}>
              {busy ? "Disabling…" : "Disable card"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.type === "reissue"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reissue the remaining balance</AlertDialogTitle>
            <AlertDialogDescription>
              Moves {availableBalanceLabel} to a brand-new card, delivered to the original recipient unless you enter another address below. This can happen once per card.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="gift-card-reissue-to">Alternative recipient (optional)</Label>
            <Input
              id="gift-card-reissue-to"
              type="email"
              value={reissueTo}
              disabled={busy}
              onChange={(event) => setReissueTo(event.target.value)}
              placeholder={card.recipientEmail ?? undefined}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void runReissue()}>
              {busy ? "Reissuing…" : "Reissue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pending?.type === "resend"} onOpenChange={(open) => { if (!open && !busy) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend the delivery email</DialogTitle>
            <DialogDescription>
              Sends the same code again, to the original recipient unless you enter another address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="gift-card-resend-to">Alternative recipient (optional)</Label>
            <Input
              id="gift-card-resend-to"
              type="email"
              value={resendTo}
              disabled={busy}
              onChange={(event) => setResendTo(event.target.value)}
              placeholder={card.recipientEmail ?? undefined}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={closeDialog}>Cancel</Button>
            <Button disabled={busy} onClick={() => void runResend()}>{busy ? "Sending…" : "Resend"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending?.type === "requeue"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-queue this delivery</AlertDialogTitle>
            <AlertDialogDescription>Sends the delivery back to pending so the drain retries it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void runRequeue()}>
              {busy ? "Re-queuing…" : "Re-queue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.type === "release"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release this hold</AlertDialogTitle>
            <AlertDialogDescription>
              Frees the reserved amount back to the card&rsquo;s available balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (pending?.type === "release") void runRelease(pending.reservation.id);
              }}
            >
              {busy ? "Releasing…" : "Release hold"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending?.type === "reveal"} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reveal the bearer code</AlertDialogTitle>
            <AlertDialogDescription>
              Revealing writes a permanent audit entry naming you as the admin who asked, and the code is bearer material — anyone who has it can redeem the card.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revealedCode && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-900 p-3">
              <code className="font-mono text-sm text-white">{revealedCode}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedCode);
                  toast.success("Code copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{revealedCode ? "Close" : "Cancel"}</AlertDialogCancel>
            {!revealedCode && (
              <AlertDialogAction
                disabled={busy}
                onClick={(event) => {
                  // Keeps the dialog open on success so the code can render
                  // inline (T-14-54) — AlertDialogAction auto-closes unless
                  // its default is prevented.
                  event.preventDefault();
                  void runReveal();
                }}
              >
                {busy ? "Revealing…" : "Reveal code"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
