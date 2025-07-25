'use client';

import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


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
      <DialogContent className="max-w-md p-8 space-y-6 text-center rounded-xl shadow-lg bg-white">
        <DialogHeader>
          <h2 className="text-2xl font-bold text-orange-500">
            Thank you for your order!
          </h2>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            Your order ID is:
          </p>
          <pre className="text-sm font-mono text-blue-300 p-2 bg-zinc-800 rounded break-words whitespace-pre-wrap">
            {orderId}
          </pre>
        </div>

        <DialogFooter className="flex flex-col gap-4 pt-4">
          <Link href="/" passHref>
            <Button
              className="flex-1 bg-black text-white hover:bg-orange-500 transition-colors" >
              Continue Shopping
            </Button>
          </Link>
          {userId && (
            <Link href="/" passHref>
              <Button
                className="flex-1 bg-black text-white hover:bg-orange-500 transition-colors" >
                View Order History
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
