'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadStripe } from '@/lib/stripe';
import { useCartStore } from '@/lib/stores/cart-store';
import {
  clearPendingCheckout,
  loadPendingCheckout,
} from '@/lib/checkout/order-payload';

type Phase = 'loading' | 'confirmed' | 'processing' | 'received' | 'failed' | 'error';

export default function CheckoutSuccessPage() {
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const clientSecret = params.get('payment_intent_client_secret');
      if (!clientSecret) {
        setPhase('error');
        return;
      }

      try {
        const stripe = await loadStripe();
        if (!stripe) throw new Error('Payment provider did not load');
        const result = await stripe.retrievePaymentIntent(clientSecret);
        if (result.error || !result.paymentIntent) throw new Error('Payment status unavailable');
        const paymentIntent = result.paymentIntent;
        const pending = loadPendingCheckout(paymentIntent.id);

        if (paymentIntent.status === 'processing') {
          // Stripe owns the in-flight payment. Lock the purchased cart now so
          // the customer cannot create a duplicate checkout while the webhook
          // retains the durable pending-order recovery path.
          useCartStore.getState().clearCart();
          setPhase('processing');
          return;
        }
        if (paymentIntent.status !== 'succeeded') {
          setPhase('failed');
          return;
        }
        if (!pending) {
          // The durable pending order and signed webhook remain the recovery
          // path when browser storage is unavailable. Never invent a receipt.
          setPhase('received');
          useCartStore.getState().clearCart();
          return;
        }

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: pending.orderId,
            paymentIntentId: paymentIntent.id,
          }),
        });
        if (!response.ok) throw new Error('Order finalization failed');
        clearPendingCheckout(paymentIntent.id);
        useCartStore.getState().clearCart();
        setOrderId(pending.orderId);
        setPhase('confirmed');
      } catch (error) {
        console.error('[checkout-return] Could not finalize payment:', error);
        setPhase('error');
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  }, []);

  const copy: Record<Phase, { title: string; message: string }> = {
    loading: { title: 'Confirming payment', message: 'Please wait while we verify your payment.' },
    confirmed: { title: 'Order confirmed', message: `Your order ${orderId} is confirmed.` },
    processing: { title: 'Payment processing', message: 'Your payment is still processing. We will finalize the order when it succeeds.' },
    received: { title: 'Payment received', message: 'Your payment was received and the server is finalizing your order. A confirmation will follow.' },
    failed: { title: 'Payment not completed', message: 'Your payment was not completed. Your cart is still available.' },
    error: { title: 'Confirmation pending', message: 'We could not confirm the order in this browser. Do not pay again; the server will retry finalization.' },
  };

  return (
    <div className="min-h-screen px-4 py-16 flex items-start justify-center">
      <section className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{copy[phase].title}</h1>
        <p className="text-gray-600 mb-6">{copy[phase].message}</p>
        <Link className="inline-flex rounded-md bg-black px-5 py-3 text-white" href="/">
          Continue shopping
        </Link>
      </section>
    </div>
  );
}
