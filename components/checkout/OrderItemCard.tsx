import Image from "next/image";
import type { CartItem } from "@/lib/types/cartitem";
import { cartItemTotal, Money } from "@/lib/money";
import type { AuthoritativeCheckoutLine } from './OrderSummary';

interface OrderItemCardProps {
  item?: CartItem;
  authoritativeLine?: AuthoritativeCheckoutLine;
}

export default function OrderItemCard({ item, authoritativeLine }: OrderItemCardProps) {
  if (!item && !authoritativeLine) return null;
  const name = authoritativeLine?.name ?? item!.name;
  const quantity = authoritativeLine?.quantity ?? item!.quantity;
  const unitPrice = authoritativeLine
    ? Money.fromMajor(authoritativeLine.unitPrice.amount, authoritativeLine.unitPrice.currency)
    : Money.fromStored(item!.price);
  const lineTotal = authoritativeLine
    ? Money.fromMajor(authoritativeLine.lineTotal.amount, authoritativeLine.lineTotal.currency)
    : cartItemTotal(item!);
  return (
    <div className="flex items-center gap-3 border rounded-lg p-1 bg-white">
      <div className="relative w-10 h-10 rounded overflow-hidden">
        {item?.primaryImageUrl && (
          <Image
            src={item.primaryImageUrl}
            alt={name}
            sizes="40px"
            fill
            className="object-cover"
          />
        )}
      </div>

      <div className="flex-1">
        <div className="font-medium text-sm leading-tight">{name}</div>
        <div className="text-xs text-gray-500">
          {quantity} × {unitPrice.format()}
        </div>
        {item?.giftCardCustomization && (
          <div className="text-xs text-gray-500">
            For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
          </div>
        )}
      </div>

      <div className="text-sm font-medium text-right min-w-[64px]">
        {lineTotal.format()}
      </div>
    </div>
  );
}
