import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findStripeCustomerId } from "@/lib/payments/customer-binding";
import { getStripeClient } from "@/lib/stripe";

export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const stripeCustomerId = await findStripeCustomerId(userId);
  if (!stripeCustomerId) return NextResponse.json({ paymentMethods: [] });

  try {
    // WR-04: Stripe's own list default page size is 10 — without an explicit
    // bound a shopper with more than 10 saved cards silently loses visibility
    // into (and the ability to remove) the rest. 100 is Stripe's own list-API
    // ceiling and matches this codebase's convention for a bounded single-page
    // fetch (app/api/webhooks/stripe/handlers/refund-handlers.ts's
    // `stripe.refunds.list({ ..., limit: 100 })`). A shopper with more than
    // 100 saved cards is not a case this store needs to auto-paginate for.
    const methods = await getStripeClient().paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 100,
    });
    const paymentMethods: SavedPaymentMethod[] = methods.data
      .filter((method) => method.card)
      .map((method) => ({
        id: method.id,
        brand: method.card!.brand,
        last4: method.card!.last4,
        expMonth: method.card!.exp_month,
        expYear: method.card!.exp_year,
      }));
    return NextResponse.json({ paymentMethods });
  } catch {
    return NextResponse.json(
      { error: "Saved payment methods are temporarily unavailable" },
      { status: 503 },
    );
  }
}
