import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStoreConfig } from "@/lib/store-config";
import {
  getSubscriptionAcquisitionService,
  SubscriptionNotFoundError,
} from "@/lib/subscriptions/acquisition-service";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { readBoundedUtf8RequestBody } from "@/lib/subscriptions/bounded-request-body";

async function hasEmptyBoundedBody(request: Request): Promise<boolean> {
  const body = await readBoundedUtf8RequestBody(request, 1_024);
  if (!body.ok) return false;
  const { text } = body;
  if (!text.trim()) return true;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === 0;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) {
    return NextResponse.json({ error: "Subscriptions are unavailable" }, { status: 404 });
  }
  const limited = await enforceRateLimit("PUBLIC_RATE_LIMITER", `subscription-action:${userId}`);
  if (limited) return limited;
  const { id } = await context.params;
  if (!/^subscription_[A-Za-z0-9_-]{1,115}$/.test(id) || id.length > 128) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (!await hasEmptyBoundedBody(request)) {
    return NextResponse.json({ error: "Invalid subscription request" }, { status: 400 });
  }
  try {
    const service = await getSubscriptionAcquisitionService();
    return NextResponse.json(await service.act(userId, id, { type: "pause" }), { status: 202 });
  } catch (error) {
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    recordTelemetry("subscription.action_failed", {
      operation: "process", outcome: "failed", provider: "stripe",
      retryable: true, path: "/api/subscriptions/:id/pause",
    }, error);
    return NextResponse.json({ error: "Subscription change is temporarily unavailable" }, { status: 503 });
  }
}
