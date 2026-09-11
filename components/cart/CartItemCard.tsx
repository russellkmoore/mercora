"use client";

import Image from "next/image";
import { useCartStore } from "@/lib/stores/cart-store";
import { useStoreConfig } from "@/lib/store";
import type { StableCartItem } from "@/lib/types/cartitem";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { cartItemTotal, Money } from "@/lib/money";
import GiftCardRecipientBlock from "@/components/gift-cards/GiftCardRecipientBlock";

interface CartItemCardProps {
  item: StableCartItem;
}

export default function CartItemCard({ item }: CartItemCardProps) {
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const pathname = usePathname();
  const isCheckoutPage = pathname.startsWith("/checkout");
  const { commerce } = useStoreConfig();
  // A StableCartItem carries no product type, so the recipient details are what
  // identify a gift-card line (D-09). Advisory only: the server refuses the
  // line whatever this renders.
  const giftCardLineUnavailable =
    item.giftCardCustomization !== undefined && !commerce.features.giftCardAcquisition;
  // Advisory only: the checkout projection already refuses a line carrying
  // this flag before any request is made (D-15).
  const giftCardNoteInvalid = item.giftCardNoteInvalid === true;

  return (
    <div className="flex gap-3 sm:gap-4 border p-3 rounded shadow-sm">
      {item.primaryImageUrl && (
        <Image
          src={item.primaryImageUrl}
          alt={item.name}
          width={56}
          height={56}
          sizes="56px"
          className="object-cover rounded shrink-0 sm:w-16 sm:h-16"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm sm:text-base truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          {!isCheckoutPage && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 text-base touch-manipulation bg-surface-inverse-elevated text-on-inverse border border-border-inverse hover:bg-surface-inverse-elevated"
              onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
            >
              -
            </Button>
          )}
          <span className="text-sm min-w-[20px] text-center">{item.quantity}</span>
          {!isCheckoutPage && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 text-base touch-manipulation bg-surface-inverse-elevated text-on-inverse border border-border-inverse hover:bg-surface-inverse-elevated"
              onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
            >
              +
            </Button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-muted-on-inverse mt-1">
          {Money.fromStored(item.price).format()} × {item.quantity} : {cartItemTotal(item).format()}
        </p>
        {giftCardLineUnavailable && (
          <p className="text-xs sm:text-sm text-warning mt-1">
            No longer available — remove this line to check out.
          </p>
        )}
        {giftCardNoteInvalid && (
          <p className="text-xs sm:text-sm text-warning mt-1">
            This gift note can no longer be sent — remove this line and add the item again to fix it.
          </p>
        )}
        {item.giftCardCustomization && (
          <GiftCardRecipientBlock customization={item.giftCardCustomization} tone="inverse" />
        )}
        {!isCheckoutPage && (
          <Button
            variant="outline"
            size="sm"
            className="text-danger mt-2 border border-danger bg-danger/10 hover:bg-primary hover:text-on-primary text-sm h-12 touch-manipulation"
            onClick={() => removeItem(item.lineId)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
