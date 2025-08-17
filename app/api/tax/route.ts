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
import { stripe, formatAmountForStripe, formatAmountFromStripe } from "@/lib/stripe";

// Fallback tax rate for when Stripe Tax is unavailable
const FALLBACK_TAX_RATE = 0.07;

interface TaxRequest {
  items: CartItem[];
  shippingAddress?: Address;
  shippingCost?: number;
}

interface TaxBreakdown {
  subtotal: number;
  shippingCost: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export async function POST(req: NextRequest) {
  try {
    const { items, shippingAddress, shippingCost = 0 }: TaxRequest = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // If no shipping address provided, use fallback calculation
    if (!shippingAddress || !shippingAddress.region || !shippingAddress.postal_code) {
      const amount = subtotal * FALLBACK_TAX_RATE;
      const breakdown: TaxBreakdown = {
        subtotal,
        shippingCost,
        taxableAmount: subtotal,
        taxAmount: amount,
        total: subtotal + shippingCost + amount,
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
      const taxAmount = await calculateStripeToleratedTax(items, shippingAddress, shippingCost);
      
      const breakdown: TaxBreakdown = {
        subtotal,
        shippingCost,
        taxableAmount: subtotal + shippingCost,
        taxAmount,
        total: subtotal + shippingCost + taxAmount,
      };

      return NextResponse.json({ 
        amount: taxAmount, 
        breakdown,
        calculated_by: "stripe"
      });

    } catch (stripeError) {
      console.error("Stripe Tax calculation failed:", stripeError);
      
      // Fall back to simple calculation
      const amount = subtotal * FALLBACK_TAX_RATE;
      const breakdown: TaxBreakdown = {
        subtotal,
        shippingCost,
        taxableAmount: subtotal,
        taxAmount: amount,
        total: subtotal + shippingCost + amount,
      };

      return NextResponse.json({ 
        amount, 
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
  shippingCost: number
): Promise<number> {
  // Build line items for Stripe Tax calculation
  const lineItems = items.map((item, index) => ({
    amount: formatAmountForStripe(item.price * item.quantity),
    reference: `item_${index}_${item.productId}`,
    tax_code: 'txcd_99999999', // General - Tangible Goods
  }));

  // Add shipping as a line item if present
  if (shippingCost > 0) {
    lineItems.push({
      amount: formatAmountForStripe(shippingCost),
      reference: 'shipping',
      tax_code: 'txcd_92010001', // Shipping
    });
  }

  // Create tax calculation with Stripe
  const calculation = await stripe.tax.calculations.create({
    currency: 'usd',
    line_items: lineItems,
    customer_details: {
      address: {
        line1: String(shippingAddress.line1),
        line2: shippingAddress.line2 ? String(shippingAddress.line2) : undefined,
        city: String(shippingAddress.city),
        state: String(shippingAddress.region),
        postal_code: String(shippingAddress.postal_code),
        country: 'US',
      },
      address_source: 'shipping',
    },
    expand: ['line_items.data.tax_breakdown'],
  });

  // Sum up all tax amounts
  const totalTaxAmount = calculation.tax_amount_exclusive || 0;
  
  return formatAmountFromStripe(totalTaxAmount);
}
