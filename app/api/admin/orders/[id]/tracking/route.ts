import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getCarrierRegistry } from "@/lib/fulfillment/carrier-config";
import { updateTracking } from "@/lib/fulfillment/service";
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

/** Replace the full carrier/tracking pair on an already-shipped order. */
export async function PATCH(
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
      { code: "invalid_tracking", error: parsed.error },
      { status: 400 },
    );
  }
  if (parsed.input.carrier === null || parsed.input.trackingNumber === null) {
    return NextResponse.json(
      { code: "invalid_tracking", error: "carrier and trackingNumber are both required" },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const result = await updateTracking(id, parsed.input, actorFrom(auth));
    switch (result.outcome) {
      case "updated":
        return NextResponse.json({
          order: toAdminOrder(result.order),
          tracking: buildShipmentView(result.order, registry),
          eventId: result.eventId,
        });
      case "not_found":
        return NextResponse.json(
          { code: "order_not_found", error: "Order not found" },
          { status: 404 },
        );
      case "conflict":
        return NextResponse.json(
          {
            code: "tracking_conflict",
            error: "Tracking changed concurrently; reload before retrying",
            status: result.order.status,
            tracking: buildShipmentView(result.order, registry),
          },
          { status: 409 },
        );
      case "not_shipped":
        return NextResponse.json(
          {
            code: "not_shipped",
            error: "Tracking can be corrected only after shipment",
            status: result.status,
          },
          { status: 409 },
        );
    }
  } catch (error) {
    console.error("PATCH /api/admin/orders/[id]/tracking failed", error);
    return NextResponse.json(
      { code: "tracking_update_failed", error: "Failed to update tracking" },
      { status: 500 },
    );
  }
}
