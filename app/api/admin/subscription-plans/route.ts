import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { recordTelemetry } from "@/lib/observability/telemetry";
import {
  parseAdminPlanQuery,
  parseCreatePlanBody,
  readPlanJson,
} from "@/lib/subscriptions/plan-api";
import {
  getSubscriptionPlanService,
  SubscriptionPlanConflictError,
  SubscriptionPlanValidationError,
} from "@/lib/subscriptions/plan-service";
import {
  SubscriptionPlanPriceMismatchError,
  SubscriptionPlanPriceUnavailableError,
} from "@/lib/subscriptions/plan-price-adapter";

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

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return denied(auth.error);
  try {
    const options = parseAdminPlanQuery(request.nextUrl.searchParams);
    const result = await (await getSubscriptionPlanService()).listAdmin(options);
    return NextResponse.json({
      plans: result.plans,
      total: result.total,
      meta: { limit: result.limit, offset: result.offset },
    });
  } catch (error) {
    if (error instanceof SubscriptionPlanValidationError) {
      return NextResponse.json({ code: "invalid_plan_query", error: error.message }, { status: 400 });
    }
    recordTelemetry("subscription.list_failed", {
      operation: "read", outcome: "failed", provider: "d1",
      retryable: true, trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "subscription_plans_read_failed", error: "Failed to load subscription plans" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) return denied(auth.error);
  try {
    const input = parseCreatePlanBody(await readPlanJson(request));
    const plan = await (await getSubscriptionPlanService()).create(input);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (error instanceof SubscriptionPlanValidationError) {
      return NextResponse.json({ code: "invalid_subscription_plan", error: error.message }, { status: 400 });
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
    recordTelemetry("subscription.action_failed", {
      operation: "create", outcome: "failed", provider: "d1",
      retryable: true, trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "subscription_plan_create_failed", error: "Failed to create subscription plan" },
      { status: 500 },
    );
  }
}
