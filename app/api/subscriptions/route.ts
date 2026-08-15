import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getStoreConfig } from "@/lib/store-config";
import { isBoundedString, isPlainRecord } from "@/lib/public-request-validation";
import {
  getSubscriptionAcquisitionService,
  SubscriptionNotFoundError,
  SubscriptionProviderConflictError,
} from "@/lib/subscriptions/acquisition-service";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 2_048;

function acquisitionEnabled(): boolean {
  const commerce = getStoreConfig().commerce;
  return commerce.features.subscriptionAcquisition
    && commerce.features.subscriptionReconciliation
    && commerce.subscriptionTermsVersion !== undefined;
}

async function setupIntentFromRequest(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainRecord(value) || Object.keys(value).some((key) => key !== "setupIntentId")
    || !isBoundedString(value.setupIntentId, 255)
    || !value.setupIntentId.startsWith("seti_")) return null;
  return value.setupIntentId;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) {
    return NextResponse.json({ error: "Subscriptions are unavailable" }, { status: 404 });
  }
  try {
    const service = await getSubscriptionAcquisitionService();
    return NextResponse.json({ subscriptions: await service.list(userId) });
  } catch (error) {
    recordTelemetry("subscription.list_failed", {
      operation: "read", outcome: "failed", provider: "d1",
      retryable: true, path: "/api/subscriptions",
    }, error);
    return NextResponse.json({ error: "Subscriptions are temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  }
  if (!acquisitionEnabled()) {
    return NextResponse.json({ error: "Subscription acquisition is unavailable" }, { status: 404 });
  }
  const limited = await enforceRateLimit("PUBLIC_RATE_LIMITER", `subscription-finalize:${userId}`);
  if (limited) return limited;
  const setupIntentId = await setupIntentFromRequest(request);
  if (!setupIntentId) return NextResponse.json({ error: "Invalid subscription request" }, { status: 400 });
  try {
    const service = await getSubscriptionAcquisitionService();
    const finalized = await service.finalize(userId, setupIntentId);
    return NextResponse.json({
      subscription: {
        id: finalized.id,
        planId: finalized.planId,
        quantity: finalized.quantity,
        status: finalized.status,
      },
    }, { status: 202 });
  } catch (error) {
    if (error instanceof SubscriptionNotFoundError) {
      // Owner mismatch deliberately shares the not-found response.
      return NextResponse.json({ error: "Subscription request was not found" }, { status: 404 });
    }
    if (error instanceof SubscriptionProviderConflictError) {
      return NextResponse.json({ error: "Subscription provider response could not be verified" }, { status: 502 });
    }
    recordTelemetry("subscription.finalize_failed", {
      operation: "create", outcome: "failed", provider: "stripe",
      retryable: true, path: "/api/subscriptions",
    }, error);
    return NextResponse.json({ error: "Subscription checkout is temporarily unavailable" }, { status: 503 });
  }
}
