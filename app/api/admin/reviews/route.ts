import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getReviewModerationMetrics, getReviewQueue } from "@/lib/models/reviews";
import type { ReviewStatus } from "@/lib/types";

function parseStatuses(value: string | null): ReviewStatus[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const allowed: ReviewStatus[] = [
    "pending",
    "needs_review",
    "published",
    "suppressed",
    "auto_rejected",
  ];
  const statuses = parts.filter((part): part is ReviewStatus =>
    (allowed as string[]).includes(part)
  );
  return statuses.length ? statuses : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const offsetParam = Number.parseInt(searchParams.get("offset") || "0", 10);
    const includeMetrics = searchParams.get("includeMetrics") === "true";
    const response = await getReviewQueue({
      statuses: parseStatuses(searchParams.get("status")),
      flaggedOnly: searchParams.get("flagged") === "true",
      productId: searchParams.get("productId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: Number.isFinite(limitParam) ? limitParam : 20,
      offset: Number.isFinite(offsetParam) ? offsetParam : 0,
    });

    const payload: Record<string, unknown> = {
      success: true,
      data: response.items,
      meta: {
        total: response.total,
        limit: Number.isFinite(limitParam) ? limitParam : 20,
        offset: Number.isFinite(offsetParam) ? offsetParam : 0,
      },
    };

    if (includeMetrics) {
      payload.metrics = await getReviewModerationMetrics();
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to load review queue", error);
    return NextResponse.json(
      { success: false, error: "Unable to load review queue" },
      { status: 500 }
    );
  }
}
