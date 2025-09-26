import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { recordReviewFlag, respondToReview, updateReviewStatus } from "@/lib/models/reviews";
import type { ReviewStatus } from "@/lib/types";

interface PatchPayload {
  status?: ReviewStatus;
  moderationNotes?: string;
  notifyCustomer?: boolean;
  response?: string;
  flagReason?: string;
  flagNotes?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Review ID is required" }, { status: 400 });
    }

    const payload = (await request.json()) as PatchPayload;
    let review = null;

    if (payload.flagReason) {
      review = await recordReviewFlag({
        reviewId: id,
        reason: payload.flagReason,
        notes: payload.flagNotes,
        flaggedBy: auth.userId ?? "admin",
      });
    }

    if (payload.status) {
      review = await updateReviewStatus({
        reviewId: id,
        status: payload.status,
        moderationNotes: payload.moderationNotes,
        notifyCustomer: payload.notifyCustomer,
        moderatorId: auth.userId ?? "admin",
      });
    }

    if (typeof payload.response === "string") {
      review = await respondToReview({
        reviewId: id,
        response: payload.response,
        notifyCustomer: payload.notifyCustomer,
        adminId: auth.userId ?? "admin",
      });
    }

    if (!review) {
      return NextResponse.json({ success: false, error: "No updates were applied" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error("Failed to update review", error);
    const message = error instanceof Error ? error.message : "Unable to update review";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
