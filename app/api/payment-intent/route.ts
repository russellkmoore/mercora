/**
 * === Payment Intent Creation ===
 *
 * Creates Stripe Payment Intents for secure payment processing.
 * Tax calculation should be done via /api/tax before calling this endpoint.
 *
 * === Features ===
 * - **Payment Intent Creation**: Secure payment setup with Stripe
 * - **Order Metadata**: Links payments to order records
 * - **Address Handling**: Shipping and billing address attachment
 * - **Error Handling**: Comprehensive error management and logging
 *
 * === Request Format ===
 * ```json
 * {
 *   "amount": number,        // Total amount including tax
 *   "taxAmount": number,     // Tax amount (from /api/tax)
 *   "shippingAddress": Address,
 *   "orderId": string,
 *   "description"?: string
 * }
 * ```
 *
 * === Response Format ===
 * ```json
 * {
 *   "clientSecret": string,
 *   "paymentIntentId": string,
 *   "amount": number
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent, formatAmountForStripe } from '@/lib/stripe';
import { Money, type StoredMoney } from '@/lib/money';
import type { Address } from '@/lib/types';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { isBoundedString, isPlainRecord } from '@/lib/public-request-validation';

interface PaymentIntentRequest {
  amount: StoredMoney;
  taxAmount: StoredMoney;
  shippingAddress: Address;
  orderId: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(
      'PUBLIC_RATE_LIMITER',
      `payment-intent:${getClientIp(req)}`
    );
    if (limited) return limited;

    const body: unknown = await req.json();
    if (!isPlainRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      amount,
      taxAmount,
      shippingAddress,
      orderId,
      description,
    } = body as unknown as PaymentIntentRequest;

    if (
      !isPlainRecord(shippingAddress) ||
      !isBoundedString(orderId, 128) ||
      (description !== undefined && !isBoundedString(description, 500, { allowEmpty: true })) ||
      !isBoundedString(shippingAddress.line1, 256) ||
      (shippingAddress.line2 !== undefined &&
        !isBoundedString(shippingAddress.line2, 256, { allowEmpty: true })) ||
      !isBoundedString(shippingAddress.city, 128) ||
      !isBoundedString(shippingAddress.region, 128) ||
      !isBoundedString(shippingAddress.postal_code, 32) ||
      (shippingAddress.recipient !== undefined &&
        !isBoundedString(shippingAddress.recipient, 256, { allowEmpty: true }))
    ) {
      return NextResponse.json({ error: 'Invalid payment details' }, { status: 400 });
    }

    let totalMoney: Money;
    let taxMoney: Money;
    try {
      totalMoney = Money.fromStored(amount);
      taxMoney = Money.fromStored(taxAmount, totalMoney.currency);
    } catch {
      return NextResponse.json(
        { error: 'Amounts must be valid integer minor-unit Money values' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!totalMoney.gt(Money.zero(totalMoney.currency))) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Create Payment Intent
    const paymentIntent = await createPaymentIntent({
      amount: formatAmountForStripe(totalMoney.toJSON()),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId,
        taxAmount: String(taxMoney.toMinorUnits()),
        totalAmount: String(totalMoney.toMinorUnits()),
      },
      shipping: {
        address: {
          line1: String(shippingAddress.line1),
          line2: shippingAddress.line2 ? String(shippingAddress.line2) : undefined,
          city: String(shippingAddress.city),
          state: String(shippingAddress.region),
          postal_code: String(shippingAddress.postal_code),
          country: 'US',
        },
        name: String(shippingAddress.recipient || 'Customer'),
      },
      description: description || `Order ${orderId}`,
    });

    return NextResponse.json({
      clientSecret: (paymentIntent as any).client_secret,
      paymentIntentId: (paymentIntent as any).id,
      amount,
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
