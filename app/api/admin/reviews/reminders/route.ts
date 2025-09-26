import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { findReviewReminderCandidates, sendReviewReminders } from "@/lib/models/reviews";

interface ReminderPayload {
  limit?: number;
  minDaysSinceDelivery?: number;
  maxDaysSinceDelivery?: number;
}

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get("limit") || "25", 10);
    const minDays = Number.parseInt(searchParams.get("minDays") || "3", 10);
    const maxDays = Number.parseInt(searchParams.get("maxDays") || "30", 10);

    const candidates = await findReviewReminderCandidates({
      limit: Number.isFinite(limit) ? limit : 25,
      minDaysSinceDelivery: Number.isFinite(minDays) ? minDays : 3,
      maxDaysSinceDelivery: Number.isFinite(maxDays) ? maxDays : 30,
    });

    return NextResponse.json({ success: true, data: candidates });
  } catch (error) {
    console.error("Failed to load reminder candidates", error);
    return NextResponse.json(
      { success: false, error: "Unable to load reminder candidates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as ReminderPayload;
    const result = await sendReviewReminders({
      limit: payload.limit,
      minDaysSinceDelivery: payload.minDaysSinceDelivery,
      maxDaysSinceDelivery: payload.maxDaysSinceDelivery,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to send reminder emails", error);
    return NextResponse.json(
      { success: false, error: "Unable to send reminders" },
      { status: 500 }
    );
  }
}
