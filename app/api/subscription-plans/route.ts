import { NextRequest, NextResponse } from "next/server";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { getStoreConfig } from "@/lib/store-config";
import { parsePublicPlanQuery } from "@/lib/subscriptions/plan-api";
import {
  getSubscriptionPlanService,
  SubscriptionPlanValidationError,
} from "@/lib/subscriptions/plan-service";

export async function GET(request: NextRequest) {
  try {
    const options = parsePublicPlanQuery(request.nextUrl.searchParams);
    const commerce = getStoreConfig().commerce;
    if (!commerce.features.subscriptionAcquisition ||
        !commerce.features.subscriptionReconciliation ||
        commerce.subscriptionTermsVersion === undefined) {
      return NextResponse.json({
        plans: [],
        total: 0,
        meta: { limit: options.limit, offset: options.offset },
      });
    }
    const result = await (await getSubscriptionPlanService()).listPublic(options);
    return NextResponse.json({
      plans: result.plans,
      total: result.total,
      meta: { limit: result.limit, offset: result.offset },
    });
  } catch (error) {
    if (error instanceof SubscriptionPlanValidationError) {
      return NextResponse.json(
        { code: "invalid_plan_query", error: error.message },
        { status: 400 },
      );
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
