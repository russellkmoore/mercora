import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getDbAsync } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema/admin_users";
import { listRecentOrderEvents } from "@/lib/fulfillment/service";
import { getOrderById } from "@/lib/models/mach/orders";
import { recordTelemetry } from "@/lib/observability/telemetry";

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 500;

/** Bounded newest-page read, projected oldest-first for an operator timeline. */
export async function GET(
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

  const rawLimit = request.nextUrl.searchParams.get("limit");
  let limit = DEFAULT_EVENT_LIMIT;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      return NextResponse.json(
        { code: "invalid_limit", error: "limit must be a positive integer" },
        { status: 400 },
      );
    }
    limit = Math.min(parsed, MAX_EVENT_LIMIT);
  }

  const { id } = await params;
  try {
    if (!(await getOrderById(id))) {
      return NextResponse.json(
        { code: "order_not_found", error: "Order not found" },
        { status: 404 },
      );
    }

    const rows = (await listRecentOrderEvents(id, limit)).reverse();
    const adminIds = [
      ...new Set(
        rows
          .filter((row) => row.actor_type === "admin" && row.actor_id)
          .map((row) => row.actor_id as string),
      ),
    ];
    let actorLabels: Record<string, string> = {};
    if (adminIds.length > 0) {
      try {
        const db = await getDbAsync();
        const admins = await db
          .select({
            userId: adminUsers.userId,
            email: adminUsers.email,
            displayName: adminUsers.displayName,
          })
          .from(adminUsers)
          .where(inArray(adminUsers.userId, adminIds));
        actorLabels = Object.fromEntries(
          admins
            .map((admin) => [
              admin.userId,
              admin.displayName?.trim() || admin.email?.trim() || "",
            ] as const)
            .filter(([, label]) => label.length > 0),
        );
      } catch (error) {
        console.warn("Could not resolve fulfillment actor labels", error);
      }
    }

    return NextResponse.json({
      events: rows.map((row) => ({
        id: row.id,
        type: row.event_type,
        actorType: row.actor_type,
        actorId: row.actor_id,
        actorLabel: row.actor_id ? (actorLabels[row.actor_id] ?? null) : null,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        details: row.details,
        createdAt: row.created_at,
      })),
      meta: { limit },
    });
  } catch (error) {
    recordTelemetry("fulfillment.query_failed", {
      operation: "process", outcome: "failed", provider: "d1", retryable: true,
      path: "/api/admin/orders/:id/events", trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "events_read_failed", error: "Failed to load order events" },
      { status: 500 },
    );
  }
}
