/**
 * === Tax Calculation API ===
 *
 * Real-time tax calculation using Stripe Tax for accurate US sales tax
 * computation based on customer location and product types.
 *
 * === Features ===
 * - **Stripe Tax Integration**: Accurate tax rates for all US jurisdictions
 * - **Real-time Calculation**: Live tax computation during checkout
 * - **Product Tax Codes**: Support for different product tax classifications
 * - **Address Validation**: Location-based tax determination
 * - **Fallback Handling**: Graceful degradation if Stripe Tax fails
 *
 * === Request Format ===
 * ```json
 * {
 *   "items": [CartItem[]],
 *   "shippingAddress": Address,
 *   "shippingCost": number
 * }
 * ```
 *
 * === Response Format ===
 * ```json
 * {
 *   "amount": number,
 *   "breakdown": TaxBreakdown,
 *   "calculated_by": "stripe" | "fallback"
 * }
 * ```
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CartItem } from "@/lib/types/cartitem";
import type { Address } from "@/lib/types";
import { calculateTax, formatAmountForStripe, formatAmountFromStripe } from "@/lib/stripe";
import { Money, cartSubtotal, type StoredMoney } from "@/lib/money";

// Fallback tax rate for when Stripe Tax is unavailable
const FALLBACK_TAX_RATE = 0.07;

interface TaxRequest {
  items: CartItem[];
  shippingAddress?: Address;
  shippingCost?: StoredMoney;
}

interface TaxBreakdown {
  subtotal: StoredMoney;
  shippingCost: StoredMoney;
  taxableAmount: StoredMoney;
  taxAmount: StoredMoney;
  total: StoredMoney;
}

export async function POST(req: NextRequest) {
  try {
    const { items, shippingAddress, shippingCost }: TaxRequest = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    const subtotal = cartSubtotal(items);
    const shipping = shippingCost ? Money.fromStored(shippingCost, subtotal.currency) : Money.zero(subtotal.currency);

    // If no shipping address provided, use fallback calculation
    if (!shippingAddress || !shippingAddress.region || !shippingAddress.postal_code) {
      const amount = subtotal.applyRate(FALLBACK_TAX_RATE);
      const breakdown: TaxBreakdown = {
        subtotal: subtotal.toJSON(),
        shippingCost: shipping.toJSON(),
        taxableAmount: subtotal.toJSON(),
        taxAmount: amount.toJSON(),
        total: subtotal.add(shipping).add(amount).toJSON(),
      };

      return NextResponse.json({ 
        amount, 
        breakdown,
        calculated_by: "fallback",
        message: "Using fallback tax rate - provide shipping address for accurate calculation"
      });
    }

    try {
      // Use Stripe Tax for accurate calculation
      const taxAmount = await calculateStripeToleratedTax(items, shippingAddress, shipping);
      
      const breakdown: TaxBreakdown = {
        subtotal: subtotal.toJSON(),
        shippingCost: shipping.toJSON(),
        taxableAmount: subtotal.add(shipping).toJSON(),
        taxAmount: taxAmount.toJSON(),
        total: subtotal.add(shipping).add(taxAmount).toJSON(),
      };

      return NextResponse.json({ 
        amount: taxAmount.toJSON(),
        breakdown,
        calculated_by: "stripe"
      });

    } catch (stripeError) {
      console.error("Stripe Tax calculation failed:", stripeError);
      
      // Fall back to simple calculation
      const amount = subtotal.applyRate(FALLBACK_TAX_RATE);
      const breakdown: TaxBreakdown = {
        subtotal: subtotal.toJSON(),
        shippingCost: shipping.toJSON(),
        taxableAmount: subtotal.toJSON(),
        taxAmount: amount.toJSON(),
        total: subtotal.add(shipping).add(amount).toJSON(),
      };

      return NextResponse.json({ 
        amount: amount.toJSON(),
        breakdown,
        calculated_by: "fallback",
        error: "Stripe Tax unavailable, using fallback rate"
      });
    }

  } catch (err) {
    console.error("Tax calculation error:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * Calculate tax using Stripe Tax API
 * Provides accurate tax calculation based on customer location
 */
async function calculateStripeToleratedTax(
  items: CartItem[], 
  shippingAddress: Address, 
  shippingCost: Money
): Promise<Money> {
  // Build line items for Stripe Tax calculation (products only)
  const lineItems = items.map((item, index) => ({
    amount: formatAmountForStripe(Money.fromStored(item.price).times(item.quantity).toJSON()),
    reference: `item_${index}_${item.productId}`,
    tax_code: 'txcd_99999999', // General - Tangible Goods
  }));

  // Build the calculation parameters
  const calculationParams: any = {
    currency: 'usd',
    line_items: lineItems,
    customer_details: {
      address: {
        line1: String(shippingAddress.line1),
        city: String(shippingAddress.city),
        state: String(shippingAddress.region),
        postal_code: String(shippingAddress.postal_code),
        country: 'US',
      },
      address_source: 'shipping',
    },
    expand: ['line_items.data.tax_breakdown'],
  };

  // Add shipping cost as a parameter (not as a line item)
  if (!shippingCost.isZero()) {
    calculationParams.shipping_cost = {
      amount: formatAmountForStripe(shippingCost.toJSON()),
      tax_code: 'txcd_92010001', // Shipping tax code
    };
  }

  // Create tax calculation with Stripe
  const calculation = await calculateTax(calculationParams);

  // Sum up all tax amounts
  const totalTaxAmount = (calculation as any).tax_amount_exclusive || 0;
  
  return Money.fromStored(formatAmountFromStripe(totalTaxAmount));
}
