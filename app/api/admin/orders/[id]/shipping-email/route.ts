import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminPermissions,
  type AdminAuthResult,
} from "@/lib/auth/admin-middleware";
import {
  buildShippingConfirmationData,
  initialShippingEmailKey,
  isConcurrentShippingEmailAttempt,
  sendShippingConfirmationEmail,
  shippingEmailFailureDetails,
  shippingEmailSuccessfulEventTypes,
  SHIPPING_EMAIL_TEMPLATE_VERSION,
} from "@/lib/fulfillment/shipping-email";
import { latestOrderEvent, recordEmailEvent } from "@/lib/fulfillment/service";
import type { Actor } from "@/lib/fulfillment/types";
import { getOrderById } from "@/lib/models/mach/orders";
import { recordTelemetry } from "@/lib/observability/telemetry";

type Mode = "retry" | "resend";
const MAX_BODY_BYTES = 1_024;
const SHIPPING_EMAIL_ATTEMPT_EVENT_TYPES = [
  "shipping_email_sent",
  "shipping_email_failed",
  "shipping_email_resent",
] as const;

function actorFrom(auth: AdminAuthResult): Actor {
  return auth.isServiceToken
    ? { type: "service", id: "api-token" }
    : { type: "admin", id: auth.userId ?? null };
}

function resendRootId(event: Awaited<ReturnType<typeof latestOrderEvent>>): string | null {
  if (!event) return null;
  if (event.event_type === "shipping_email_sent") return event.id;
  const details = event.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const root = (details as Record<string, unknown>).resendOfEventId;
  return typeof root === "string" && root ? root : null;
}

async function readMode(request: NextRequest): Promise<
  | { ok: true; mode: Mode }
  | { ok: false; status: number; code: string; error: string }
> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "body_too_large",
      error: "Request body is too large",
    };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "body_too_large",
      error: "Request body is too large",
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, code: "invalid_json", error: "Invalid request body" };
  }
  const mode =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).mode
      : null;
  if (mode !== "retry" && mode !== "resend") {
    return {
      ok: false,
      status: 400,
      code: "invalid_mode",
      error: 'Mode must be "retry" or "resend"',
    };
  }
  return { ok: true, mode };
}

async function recordOutcome(
  orderId: string,
  type: "shipping_email_sent" | "shipping_email_failed" | "shipping_email_resent",
  actor: Actor,
  details: Record<string, unknown>,
): Promise<string | null> {
  try {
    return await recordEmailEvent(orderId, type, actor, details);
  } catch (error) {
    recordTelemetry("email.audit_write_failed", {
      operation: "audit_write", outcome: "failed", provider: "d1",
      retryable: true, path: "/api/admin/orders/:id/shipping-email", trigger: "request",
    }, error);
    return null;
  }
}

function projectedAttempt(
  event: Awaited<ReturnType<typeof latestOrderEvent>>,
) {
  if (!event) return null;
  const details = event.details;
  const rawError = details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>).error
    : null;
  const needsReview = details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>).needsReview === true
    : false;
  return {
    type: event.event_type,
    needsReview,
    error: typeof rawError === "string" && rawError.trim()
      ? rawError.trim().slice(0, 300)
      : null,
  };
}

/** Authoritative bounded projection for choosing retry versus resend. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json(
      { code: "unauthorized", error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  try {
    if (!(await getOrderById(id))) {
      return NextResponse.json(
        { code: "order_not_found", error: "Order not found" },
        { status: 404 },
      );
    }
    const [latestSuccess, latestAttempt] = await Promise.all([
      latestOrderEvent(id, shippingEmailSuccessfulEventTypes),
      latestOrderEvent(id, SHIPPING_EMAIL_ATTEMPT_EVENT_TYPES),
    ]);
    return NextResponse.json({
      status: {
        hasSuccessfulSend: latestSuccess !== null,
        latestAttempt: projectedAttempt(latestAttempt),
      },
    });
  } catch (error) {
    recordTelemetry("email.audit_write_failed", {
      operation: "audit_write", outcome: "failed", provider: "d1",
      retryable: true, path: "/api/admin/orders/:id/shipping-email", trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "shipping_email_status_failed", error: "Failed to load shipping email status" },
      { status: 500 },
    );
  }
}

/** Retry a failed initial send, or explicitly resend a previously sent email. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json(
      { code: "unauthorized", error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const parsed = await readMode(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { code: parsed.code, error: parsed.error },
      { status: parsed.status },
    );
  }

  const { id } = await params;
  try {
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json(
        { code: "order_not_found", error: "Order not found" },
        { status: 404 },
      );
    }
    if (order.status !== "shipped") {
      return NextResponse.json(
        {
          code: "not_shipped",
          error: "Shipping email is available only for shipped orders",
          status: order.status,
        },
        { status: 409 },
      );
    }

    const [lastSuccess, latestAttempt] = await Promise.all([
      latestOrderEvent(id, shippingEmailSuccessfulEventTypes),
      latestOrderEvent(id, SHIPPING_EMAIL_ATTEMPT_EVENT_TYPES),
    ]);
    if (projectedAttempt(latestAttempt)?.needsReview) {
      return NextResponse.json({
        code: "shipping_email_needs_review",
        error: "The latest shipping email may have been accepted and requires manual review before another send",
      }, { status: 409 });
    }
    if (parsed.mode === "retry" && lastSuccess) {
      return NextResponse.json(
        { code: "wrong_mode", error: "Use resend after a successful shipping email" },
        { status: 409 },
      );
    }
    if (parsed.mode === "resend" && !lastSuccess) {
      return NextResponse.json(
        { code: "wrong_mode", error: "Retry the initial email before resending" },
        { status: 409 },
      );
    }

    const actor = actorFrom(auth);
    const data = await buildShippingConfirmationData(order);
    const idempotencyKey =
      parsed.mode === "resend"
        ? `shipping-confirmation/${id}/resend/v${SHIPPING_EMAIL_TEMPLATE_VERSION}/${crypto.randomUUID()}`
        : data
          ? initialShippingEmailKey(id)
          : `shipping-confirmation/${id}/initial/no-recipient`;

    if (!data) {
      const eventId = await recordOutcome(id, "shipping_email_failed", actor, {
        idempotencyKey,
        error: "no_customer_email",
      });
      return NextResponse.json({
        email: { success: false, error: "no_customer_email" },
        eventId,
        auditRecorded: eventId !== null,
      });
    }

    const result = await sendShippingConfirmationEmail(data, idempotencyKey);
    if (!result.success) {
      const concurrentDuplicate = isConcurrentShippingEmailAttempt(result);
      if (concurrentDuplicate) {
        return NextResponse.json({
          email: {
            success: false,
            pending: true,
            error: result.error || "An identical shipping email is still processing",
            ...(result.errorCode ? { errorCode: result.errorCode } : {}),
          },
          eventId: null,
          auditRecorded: false,
        }, { status: 202 });
      } else {
        recordTelemetry("email.delivery_failed", {
          operation: "send", outcome: "failed", provider: "resend",
          retryable: true, path: "/api/admin/orders/:id/shipping-email", trigger: "manual",
        });
      }
      const eventId = await recordOutcome(
        id,
        "shipping_email_failed",
        actor,
        shippingEmailFailureDetails(idempotencyKey, result),
      );
      return NextResponse.json({
        email: {
          success: false,
          ...(result.needsReview ? { needsReview: true } : {}),
          error: result.error || "Shipping email failed",
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        },
        eventId,
        auditRecorded: eventId !== null,
      });
    }

    const eventType =
      parsed.mode === "resend" ? "shipping_email_resent" : "shipping_email_sent";
    const eventId = await recordOutcome(id, eventType, actor, {
      idempotencyKey,
      ...(result.providerId ? { providerId: result.providerId } : {}),
      ...(parsed.mode === "resend" ? { resendOfEventId: resendRootId(lastSuccess) } : {}),
    });
    return NextResponse.json({
      email: { success: true },
      eventId,
      auditRecorded: eventId !== null,
    });
  } catch (error) {
    recordTelemetry("email.delivery_failed", {
      operation: "send", outcome: "failed", retryable: true,
      path: "/api/admin/orders/:id/shipping-email", trigger: "manual",
    }, error);
    return NextResponse.json(
      { code: "shipping_email_failed", error: "Failed to send shipping email" },
      { status: 500 },
    );
  }
}
