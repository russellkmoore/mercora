import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getCarrierRegistry } from "@/lib/fulfillment/carrier-config";
import { shipOrder } from "@/lib/fulfillment/service";
import { sendInitialShippingEmail } from "@/lib/fulfillment/shipping-email";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import { parseShipmentInput } from "@/lib/fulfillment/transitions";
import type { Actor } from "@/lib/fulfillment/types";
import { toAdminOrder } from "@/lib/models/mach/order-serializer";

const MAX_JSON_BODY_BYTES = 4 * 1_024;

async function readBoundedJsonBody(
  request: Request,
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; code: "invalid_json" | "request_too_large"; error: string; status: 400 | 413 }
> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }
  if (!raw) return { ok: true, body: {} };

  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, code: "invalid_json", error: "Invalid request body", status: 400 };
  }
}

function actorFrom(auth: Awaited<ReturnType<typeof checkAdminPermissions>>): Actor {
  return auth.isServiceToken
    ? { type: "service", id: "api-token" }
    : { type: "admin", id: auth.userId ?? null };
}

/** Paid processing -> shipped. Shipment state commits before any later email seam. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json(
      { code: "unauthorized", error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { code: bodyResult.code, error: bodyResult.error },
      { status: bodyResult.status },
    );
  }
  const registry = getCarrierRegistry();
  const parsed = parseShipmentInput(bodyResult.body, registry);
  if (!parsed.ok) {
    return NextResponse.json(
      { code: "invalid_shipment", error: parsed.error },
      { status: 400 },
    );
  }

  const { id } = await params;
  const actor = actorFrom(auth);
  try {
    const result = await shipOrder(id, parsed.input, actor, registry);
    switch (result.outcome) {
      case "shipped": {
        // Shipment state and its audit event have already committed. Email is
        // deliberately best-effort and can never turn that success into a 500.
        let email;
        try {
          email = await sendInitialShippingEmail(id, actor);
        } catch (error) {
          console.error("shipping_email_post_commit_threw", { orderId: id, error });
          email = { attempted: false, success: false, error: "shipping_email_failed" };
        }
        return NextResponse.json(
          {
            order: toAdminOrder(result.order),
            tracking: buildShipmentView(result.order, registry),
            email,
            eventId: result.eventId,
          },
          { status: 201 },
        );
      }
      case "already_shipped":
        return NextResponse.json({
          order: toAdminOrder(result.order),
          tracking: buildShipmentView(result.order, registry),
          email: { attempted: false },
          eventId: null,
          idempotent: true,
        });
      case "not_found":
        return NextResponse.json(
          { code: "order_not_found", error: "Order not found" },
          { status: 404 },
        );
      case "conflict":
        return NextResponse.json(
          {
            code: "shipment_conflict",
            error: "Order was already shipped with different shipment data",
            status: result.order.status,
            paymentStatus: result.order.payment_status ?? null,
            tracking: buildShipmentView(result.order, registry),
          },
          { status: 409 },
        );
      case "not_fulfillable":
        return NextResponse.json(
          {
            code: result.refundPending ? "refund_pending" : "not_fulfillable",
            error: result.refundPending
              ? "Shipping is blocked while a refund awaits settlement"
              : "Order is not in a fulfillable state",
            status: result.status,
            paymentStatus: result.paymentStatus,
            refundPending: result.refundPending ?? false,
          },
          { status: 409 },
        );
    }
  } catch (error) {
    console.error("POST /api/admin/orders/[id]/ship failed", error);
    return NextResponse.json(
      { code: "shipment_failed", error: "Failed to ship order" },
      { status: 500 },
    );
  }
}
