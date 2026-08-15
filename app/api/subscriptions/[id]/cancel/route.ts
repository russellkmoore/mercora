import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStoreConfig } from "@/lib/store-config";
import { isPlainRecord } from "@/lib/public-request-validation";
import {
  getSubscriptionAcquisitionService,
  SubscriptionNotFoundError,
} from "@/lib/subscriptions/acquisition-service";
import { recordTelemetry } from "@/lib/observability/telemetry";

async function cancellationMode(request: Request): Promise<"period_end" | "immediate" | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > 1_024) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 1_024) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainRecord(value) || Object.keys(value).some((key) => key !== "mode")) return null;
  return value.mode === "period_end" || value.mode === "immediate" ? value.mode : null;
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
  const mode = await cancellationMode(request);
  if (!mode) return NextResponse.json({ error: "Invalid cancellation request" }, { status: 400 });
  try {
    const service = await getSubscriptionAcquisitionService();
    return NextResponse.json(
      await service.act(userId, id, { type: "cancel", mode }),
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    recordTelemetry("subscription.action_failed", {
      operation: "process", outcome: "failed", provider: "stripe",
      retryable: true, path: "/api/subscriptions/:id/cancel",
    }, error);
    return NextResponse.json({ error: "Subscription change is temporarily unavailable" }, { status: 503 });
  }
}
