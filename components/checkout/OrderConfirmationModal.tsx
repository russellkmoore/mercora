"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  userId?: string | null;
}

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  orderId,
  userId,
}: OrderConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-8 space-y-6 text-center rounded-xl shadow-lg bg-surface-elevated">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            Thank you for your order!
          </DialogTitle>
          <DialogDescription>
            Your order has been successfully placed and is being processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Your order ID is:</p>
          <pre className="text-sm font-mono text-info p-2 bg-surface rounded wrap-break-word whitespace-pre-wrap">
            {orderId}
          </pre>
        </div>

        <DialogFooter className="flex flex-col gap-4 pt-4">
          <Button
            asChild
            className="flex-1 bg-surface text-foreground hover:bg-primary transition-colors"
          >
            <Link href="/">Continue Shopping</Link>
          </Button>
          {userId && (
            <Button
              asChild
              className="flex-1 bg-surface text-foreground hover:bg-primary transition-colors"
            >
              <Link href="/orders">View Order History</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
