import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { parseUpdatePlanBody, readPlanJson } from "@/lib/subscriptions/plan-api";
import {
  assertSubscriptionPlanId,
  getSubscriptionPlanService,
  SubscriptionPlanConflictError,
  SubscriptionPlanNotFoundError,
  SubscriptionPlanValidationError,
} from "@/lib/subscriptions/plan-service";
import {
  SubscriptionPlanPriceMismatchError,
  SubscriptionPlanPriceUnavailableError,
} from "@/lib/subscriptions/plan-price-adapter";

interface RouteContext { params: Promise<{ id: string }> }

function denied(error?: string) {
  const originDenied = error === "Request origin validation failed.";
  return NextResponse.json(
    {
      code: originDenied ? "forbidden" : "unauthorized",
      error: originDenied ? "Request origin validation failed" : "Admin access required",
    },
    { status: originDenied ? 403 : 401 },
  );
}

function knownError(error: unknown): NextResponse | undefined {
  if (error instanceof SubscriptionPlanValidationError) {
    return NextResponse.json({ code: "invalid_subscription_plan", error: error.message }, { status: 400 });
  }
  if (error instanceof SubscriptionPlanNotFoundError) {
    return NextResponse.json({ code: "subscription_plan_not_found", error: error.message }, { status: 404 });
  }
  if (error instanceof SubscriptionPlanConflictError) {
    return NextResponse.json({ code: "subscription_plan_conflict", error: error.message }, { status: 409 });
  }
  if (error instanceof SubscriptionPlanPriceMismatchError) {
    return NextResponse.json({
      code: "subscription_plan_price_mismatch",
      error: "Stripe Price does not match the subscription plan",
    }, { status: 409 });
  }
  return undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return denied(auth.error);
  try {
    const { id } = await context.params;
    assertSubscriptionPlanId(id);
    const plan = await (await getSubscriptionPlanService()).getAdmin(id);
    return NextResponse.json({ plan });
  } catch (error) {
    const response = knownError(error);
    if (response) return response;
    recordTelemetry("subscription.list_failed", {
      operation: "read", outcome: "failed", provider: "d1",
      retryable: true, trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "subscription_plan_read_failed", error: "Failed to load subscription plan" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return denied(auth.error);
  try {
    const { id } = await context.params;
    assertSubscriptionPlanId(id);
    const { expectedUpdatedAt, patch } = parseUpdatePlanBody(await readPlanJson(request));
    const plan = await (await getSubscriptionPlanService()).update(id, patch, expectedUpdatedAt);
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof SubscriptionPlanPriceUnavailableError) {
      recordTelemetry("subscription.action_failed", {
        operation: "validate", outcome: "unavailable", provider: "stripe",
        retryable: true, trigger: "request",
      }, error);
      return NextResponse.json({
        code: "subscription_plan_price_unavailable",
        error: "Stripe Price verification is temporarily unavailable",
      }, { status: 503 });
    }
    const response = knownError(error);
    if (response) return response;
    recordTelemetry("subscription.action_failed", {
      operation: "transition", outcome: "failed", provider: "d1",
      retryable: true, trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "subscription_plan_update_failed", error: "Failed to update subscription plan" },
      { status: 500 },
    );
  }
}
