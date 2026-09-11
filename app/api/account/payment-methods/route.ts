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
    const methods = await getStripeClient().paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
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
