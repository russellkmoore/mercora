"use client";

import { useMemo, useState } from "react";
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
import { AlertTriangle, RefreshCw, Truck } from "lucide-react";
import {
  shipmentSubmitPayload,
  trackingPreview,
  validateShipmentDraft,
  type CarrierOption,
  type ShipmentSubmit,
} from "./queue-model";

export type { ShipmentSubmit } from "./queue-model";

interface ShipmentModalProps {
  mode: "ship" | "tracking";
  orderId: string;
  carriers: CarrierOption[];
  initialCarrier?: string | null;
  initialTrackingNumber?: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: ShipmentSubmit) => void;
}

export default function ShipmentModal({
  mode,
  orderId,
  carriers,
  initialCarrier,
  initialTrackingNumber,
  busy,
  error,
  onCancel,
  onSubmit,
}: ShipmentModalProps) {
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [tracking, setTracking] = useState(initialTrackingNumber ?? "");
  const selected = useMemo(
    () => carriers.find((candidate) => candidate.code === carrier) ?? null,
    [carrier, carriers],
  );
  const validationError = validateShipmentDraft(mode, carrier, tracking);
  const preview = validationError ? null : trackingPreview(selected, tracking);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "ship" ? `Mark order #${orderId} shipped` : `Edit tracking for #${orderId}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "ship"
              ? "Carrier and tracking are optional as a pair. Leave both blank for an untracked shipment."
              : "Correct the stored carrier and tracking number. This action does not send an email."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="shipment-carrier" className="mb-2 block">Carrier</Label>
            <select
              id="shipment-carrier"
              className="admin-input w-full rounded-md border px-3 py-2"
              value={carrier}
              disabled={busy}
              onChange={(event) => setCarrier(event.target.value)}
            >
              <option value="">{mode === "ship" ? "No carrier (untracked)" : "Choose a carrier"}</option>
              {carriers.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="shipment-tracking" className="mb-2 block">Tracking number</Label>
            <Input
              id="shipment-tracking"
              className="admin-input"
              value={tracking}
              disabled={busy}
              onChange={(event) => setTracking(event.target.value)}
            />
          </div>
          <div className="rounded bg-surface p-3 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Customer tracking link</p>
            {preview ? (
              <a className="break-all text-primary-600 hover:underline" href={preview} target="_blank" rel="noreferrer noopener">
                {preview}
              </a>
            ) : (
              <p>
                {validationError
                  ? "Enter a valid tracking number to preview its link."
                  : tracking
                    ? "This carrier does not provide a tracking link."
                    : "No tracking link."}
              </p>
            )}
          </div>
          {(validationError || error) && (
            <p role="alert" className="flex items-start gap-2 text-sm text-state-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {validationError || error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button
            disabled={busy || Boolean(validationError)}
            onClick={() => onSubmit(shipmentSubmitPayload(carrier, tracking))}
          >
            {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            {mode === "ship" ? "Confirm shipment" : "Save tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
