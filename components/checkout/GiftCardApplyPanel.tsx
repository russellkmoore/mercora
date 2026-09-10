'use client';

import { Gift, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { maskGiftCardCode } from '@/lib/gift-cards/code';

interface GiftCardApplyPanelProps {
  /** The code being typed (not yet applied). */
  value: string;
  onChange: (value: string) => void;
  /** The code applied to the current quote, if any. */
  appliedCode?: string;
  onApply: () => void;
  onRemove: () => void;
  busy?: boolean;
}

/**
 * Gift-card tender on the Payment Information step.
 *
 * A gift card is a form of payment, so it lives beside the card form rather
 * than with the discount code. Applying re-quotes the order on the server (a
 * new PaymentIntent for the remaining balance) and the parent swaps the Stripe
 * form to the new quote; removing re-quotes without the card and releases its
 * hold. The masked code shown after applying is derived on the client from the
 * code the shopper typed — the server never returns a code.
 */
export default function GiftCardApplyPanel({
  value,
  onChange,
  appliedCode,
  onApply,
  onRemove,
  busy = false,
}: GiftCardApplyPanelProps) {
  const masked = appliedCode ? maskGiftCardCode(appliedCode) : null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-3 text-foreground">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Gift className="h-4 w-4" />
        <span>Pay with a gift card</span>
      </div>

      {masked ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-success bg-success/10 px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium text-success">{masked}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove gift card"
            className="h-6 w-6 p-0 text-success hover:text-success/90 hover:bg-success/10"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            id="gift-card-code"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (value.trim() && !busy) onApply();
              }
            }}
            autoComplete="off"
            maxLength={512}
            disabled={busy}
            className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Enter gift card code"
          />
          <Button
            type="button"
            size="sm"
            onClick={onApply}
            disabled={busy || !value.trim()}
            className="bg-primary hover:bg-primary/80 text-on-primary"
          >
            {busy ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {masked
          ? 'Applied to this order. The rest is charged to your payment method below.'
          : 'The card covers as much of the total as it can; pay any remainder below.'}
      </p>
    </div>
  );
}
