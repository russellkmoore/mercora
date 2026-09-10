"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddressForm } from "@/components/account/AddressForm";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";

interface AddAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (address: MACHCustomerAddress) => void;
}

export default function AddAddressDialog({ open, onOpenChange, onSaved }: AddAddressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface-elevated text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a shipping address</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This address is saved to your account and selected for this subscription.
          </DialogDescription>
        </DialogHeader>
        <AddressForm
          mode="create"
          lockType="shipping"
          submitLabel="Save address"
          onSaved={onSaved}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
