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
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import type { Address } from '@/lib/types';

interface PaymentIntentRequest {
  amount: number;
  taxAmount: number;
  shippingAddress: Address;
  orderId: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      amount,
      taxAmount,
      shippingAddress,
      orderId,
      description,
    }: PaymentIntentRequest = await req.json();

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId,
        taxAmount: taxAmount.toString(),
        totalAmount: amount.toString(),
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
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
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

