import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { findStripeCustomerId } from "@/lib/payments/customer-binding";
import { getStripeClient } from "@/lib/stripe";

function denial() {
  return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
}

/**
 * WR-01: a syntactically valid but nonexistent `pm_` id must read the same
 * as an id that exists but belongs to someone else (denial(), 404) — never a
 * 503 — or the status code itself tells a probing caller "this id doesn't
 * exist" vs. "this id exists, for someone else." Duck-typed against
 * `type`/`code`, matching the established codebase convention
 * (lib/subscriptions/plan-price-adapter.ts's isMissingStripePrice) rather
 * than `instanceof Stripe.errors.StripeInvalidRequestError`, which real
 * Stripe SDK errors satisfy but a plain rejected Error in a unit test does
 * not.
 */
function isResourceMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { type?: unknown; code?: unknown; raw?: { code?: unknown } };
  return candidate.type === "StripeInvalidRequestError"
    && (candidate.code === "resource_missing" || candidate.raw?.code === "resource_missing");
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
  } catch (error) {
    if (isResourceMissingError(error)) return denial();
    return NextResponse.json(
      { error: "The payment method could not be removed right now" },
      { status: 503 },
    );
  }
}
