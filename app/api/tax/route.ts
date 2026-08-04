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
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  isBoundedString,
  isPlainRecord,
  isValidPublicCartItems,
} from "@/lib/public-request-validation";

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
    const limited = await enforceRateLimit(
      "PUBLIC_RATE_LIMITER",
      `tax:${getClientIp(req)}`
    );
    if (limited) return limited;

    const body: unknown = await req.json();
    if (!isPlainRecord(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { items, shippingAddress, shippingCost } = body as unknown as TaxRequest;

    if (!isValidPublicCartItems(items)) {
      return NextResponse.json({ error: "Cart items are missing or invalid" }, { status: 400 });
    }

    if (
      shippingAddress !== undefined &&
      (!isPlainRecord(shippingAddress) ||
        (shippingAddress.region !== undefined &&
          !isBoundedString(shippingAddress.region, 128, { allowEmpty: true })) ||
        (shippingAddress.postal_code !== undefined &&
          !isBoundedString(shippingAddress.postal_code, 32, { allowEmpty: true })) ||
        (shippingAddress.line1 !== undefined &&
          !isBoundedString(shippingAddress.line1, 256, { allowEmpty: true })) ||
        (shippingAddress.city !== undefined &&
          !isBoundedString(shippingAddress.city, 128, { allowEmpty: true })))
    ) {
      return NextResponse.json({ error: "Invalid shipping address" }, { status: 400 });
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
        amount: amount.toJSON(),
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
