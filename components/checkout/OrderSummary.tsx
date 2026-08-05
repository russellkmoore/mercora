import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import OrderItemCard from "./OrderItemCard";
import DiscountCodeInput from "./DiscountCodeInput";
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
  authoritativeQuote?: AuthoritativeCheckoutQuote;
}

export default function OrderSummary({
  items,
  shippingOption,
  taxAmount,
  showDiscountInput = false,
  authoritativeQuote,
}: Props) {
  const { appliedDiscounts } = useCartStore();
  
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
    <div className="bg-white text-black p-6 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

      <div className="space-y-1">
        {authoritativeQuote
          ? authoritativeQuote.items.map((line, idx) => {
              const item = items.find((candidate) =>
                candidate.productId === line.productId &&
                candidate.variantId === line.variantId
              );
              return (
                <OrderItemCard
                  key={`${line.productId}:${line.variantId ?? ''}:${idx}`}
                  item={item}
                  authoritativeLine={line}
                />
              );
            })
          : items.map((item, idx) => (
              <OrderItemCard key={idx} item={item} />
            ))}
      </div>

      {showDiscountInput && (
        <>
          <hr className="my-4" />
          <DiscountCodeInput />
        </>
      )}

      <hr className="my-2" />

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{(authoritative?.subtotal ?? subtotal).format()}</span>
      </div>
      
      {/* Cart Discounts */}
      {!authoritative && cartDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      {authoritative && !authoritative.discount.isZero() && (
        <div className="flex justify-between text-sm text-green-600">
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
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Tax</span>
        <span>{(authoritative?.tax ?? tax).format()}</span>
      </div>

      {authoritative && !authoritative.tender.isZero() && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Other tender</span>
          <span>-{authoritative.tender.format()}</span>
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
