import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { findStripeCustomerId } from "@/lib/payments/customer-binding";
import { getStripeClient } from "@/lib/stripe";

function denial() {
  return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });

  const { id } = await context.params;
  if (!id || id.length > 80) return denial();

  const stripeCustomerId = await findStripeCustomerId(userId);
  if (!stripeCustomerId) return denial();

  const stripe = getStripeClient();
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(id);
    const owner = typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id;
    if (owner !== stripeCustomerId) return denial();

    await stripe.paymentMethods.detach(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "The payment method could not be removed right now" },
      { status: 503 },
    );
  }
}
