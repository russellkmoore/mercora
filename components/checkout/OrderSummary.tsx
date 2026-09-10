import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import OrderItemCard from "./OrderItemCard";
import DiscountCodeInput from "./DiscountCodeInput";
import { Gift } from "lucide-react";
import { maskGiftCardCode } from "@/lib/gift-cards/code";
import { useCartStore } from "@/lib/stores/cart-store";
import { Money, cartSubtotal, type MachMoney } from "@/lib/money";

export interface AuthoritativeCheckoutQuote {
  items: AuthoritativeCheckoutLine[];
  subtotal: MachMoney;
  discount: MachMoney;
  shipping: MachMoney;
  tax: MachMoney;
  tender: MachMoney;
  total: MachMoney;
}

export interface AuthoritativeCheckoutLine {
  lineId?: string;
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: MachMoney;
  lineTotal: MachMoney;
}

interface Props {
  items: CartItem[];
  shippingOption?: ShippingOption;
  taxAmount?: { amount: number; currency: string };
  showDiscountInput?: boolean;
  /**
   * Gift-card code entry. Rendered beside the discount-code input, because that
   * is where shoppers look for "a code" — the old placement (a separate box
   * under this summary, gone once the quote existed) was reported as
   * "nowhere to enter it". The code is applied when the quote is created.
   */
  giftCard?: { value: string; onChange: (value: string) => void };
  authoritativeQuote?: AuthoritativeCheckoutQuote;
}

export default function OrderSummary({
  items,
  shippingOption,
  taxAmount,
  showDiscountInput = false,
  giftCard,
  authoritativeQuote,
}: Props) {
  const { appliedDiscounts } = useCartStore();
  // The only tender the store accepts is a gift card; show which one, masked
  // to its last group, from the code the shopper typed (never from the server).
  const maskedGiftCard = giftCard ? maskGiftCardCode(giftCard.value) : null;
  
  // Calculate totals from cart store if discounts are applied, otherwise use simple calculation
  const subtotal = cartSubtotal(items);
  const shippingCost = shippingOption ? Money.fromStored(shippingOption.cost) : Money.zero(subtotal.currency);
  
  // Calculate discounts
  const cartDiscounts = appliedDiscounts.filter(d => d.type === 'cart');
  const shippingDiscounts = appliedDiscounts.filter(d => d.type === 'shipping');
  
  const cartDiscountAmount = cartDiscounts.reduce((sum, d) => sum.add(Money.fromStored(d.amount)), Money.zero(subtotal.currency));
  const shippingDiscountAmount = shippingDiscounts.reduce((sum, d) => sum.add(Money.fromStored(d.amount)), Money.zero(subtotal.currency));
  
  const discountedSubtotal = subtotal.lte(cartDiscountAmount) ? Money.zero(subtotal.currency) : subtotal.subtract(cartDiscountAmount);
  const discountedShipping = shippingCost.lte(shippingDiscountAmount) ? Money.zero(subtotal.currency) : shippingCost.subtract(shippingDiscountAmount);
  const tax = taxAmount ? Money.fromStored(taxAmount, subtotal.currency) : Money.zero(subtotal.currency);
  const total = discountedSubtotal.add(discountedShipping).add(tax);
  const authoritative = authoritativeQuote ? {
    subtotal: Money.fromMajor(authoritativeQuote.subtotal.amount, authoritativeQuote.subtotal.currency),
    discount: Money.fromMajor(authoritativeQuote.discount.amount, authoritativeQuote.discount.currency),
    shipping: Money.fromMajor(authoritativeQuote.shipping.amount, authoritativeQuote.shipping.currency),
    tax: Money.fromMajor(authoritativeQuote.tax.amount, authoritativeQuote.tax.currency),
    tender: Money.fromMajor(authoritativeQuote.tender.amount, authoritativeQuote.tender.currency),
    total: Money.fromMajor(authoritativeQuote.total.amount, authoritativeQuote.total.currency),
  } : null;

  return (
    <div className="bg-surface-elevated text-foreground p-6 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

      <div className="space-y-1">
        {authoritativeQuote
          ? authoritativeQuote.items.map((line, idx) => {
              const item = line.lineId
                ? items.find((candidate) => candidate.lineId === line.lineId)
                : items[idx] ?? items.find((candidate) =>
                  candidate.productId === line.productId &&
                  candidate.variantId === line.variantId
                );
              return (
                <OrderItemCard
                  key={line.lineId ?? item?.lineId ?? `${line.productId}:${line.variantId ?? ''}:${idx}`}
                  item={item}
                  authoritativeLine={line}
                />
              );
            })
          : items.map((item) => (
              <OrderItemCard key={item.lineId} item={item} />
            ))}
      </div>

      {showDiscountInput && (
        <>
          <hr className="my-4" />
          <DiscountCodeInput />
        </>
      )}

      {showDiscountInput && giftCard && (
        <div className="mt-4 space-y-2">
          <label
            htmlFor="gift-card-code"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Gift className="h-4 w-4" />
            <span>Have a gift card?</span>
          </label>
          <input
            id="gift-card-code"
            type="text"
            value={giftCard.value}
            onChange={(event) => giftCard.onChange(event.target.value)}
            autoComplete="off"
            maxLength={512}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
            placeholder="Enter gift card code"
          />
          <p className="text-xs text-muted-foreground">
            Applied when you continue to payment.
          </p>
        </div>
      )}

      <hr className="my-2" />

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{(authoritative?.subtotal ?? subtotal).format()}</span>
      </div>
      
      {/* Cart Discounts */}
      {!authoritative && cartDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-success">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      {authoritative && !authoritative.discount.isZero() && (
        <div className="flex justify-between text-sm text-success">
          <span>Discount</span>
          <span>-{authoritative.discount.format()}</span>
        </div>
      )}
      
      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span>{(authoritative?.shipping ?? shippingCost).format()}</span>
      </div>
      
      {/* Shipping Discounts */}
      {!authoritative && shippingDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-success">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Tax</span>
        <span>{(authoritative?.tax ?? tax).format()}</span>
      </div>

      {authoritative && !authoritative.tender.isZero() && (
        <div className="flex justify-between gap-4 text-sm text-success">
          <span className="min-w-0 truncate">
            Gift card{maskedGiftCard ? ` ${maskedGiftCard}` : ''}
          </span>
          <span className="shrink-0">-{authoritative.tender.format()}</span>
        </div>
      )}

      <hr className="my-2" />

      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{(authoritative?.total ?? total).format()}</span>
      </div>
    </div>
  );
}
