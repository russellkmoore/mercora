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
import type { StableCartItem } from "@/lib/types/cartitem";
import { Money } from "@/lib/money";
import GiftCardRecipientBlock from "@/components/gift-cards/GiftCardRecipientBlock";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  userId?: string | null;
  items?: StableCartItem[];
}

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  orderId,
  userId,
  items,
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

        {items && items.length > 0 && (
          <div className="space-y-2 text-left">
            <h3 className="text-sm font-semibold text-foreground">Order items</h3>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {items.map((item) => (
                <div
                  key={item.lineId}
                  className="flex items-center gap-3 rounded-lg p-2 bg-surface text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.quantity} × {Money.fromStored(item.price).format()}
                    </div>
                    {item.giftCardCustomization && (
                      <GiftCardRecipientBlock customization={item.giftCardCustomization} />
                    )}
                  </div>
                  <div className="text-sm font-medium">
                    {Money.fromStored(item.price).times(item.quantity).format()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
