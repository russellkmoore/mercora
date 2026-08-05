/**
 * === Admin Analytics Refresh ===
 *
 * Manually regenerates the Admin BI dashboard payload for the requested time
 * range and upserts it into the D1 `analytics_cache` table. This runs the same
 * generator (`regenerateAnalytics`) the scheduled cron uses, but for a single
 * range so the button stays responsive (one Workers AI call, not three). The
 * 6-hour cron keeps all ranges fresh.
 *
 * POST /api/admin/analytics/refresh
 *   Body (optional): { "range": "7d" | "30d" | "90d" }  (defaults to "30d")
 *   Returns the fresh payload for that range.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  regenerateAnalytics,
  isAnalyticsRange,
  type AnalyticsRange,
} from "@/lib/analytics/generate-insights";

export async function POST(req: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { range?: string };
    const requested: AnalyticsRange = isAnalyticsRange(body.range) ? body.range : "30d";

    // Regenerate only the currently-viewed range for a responsive button
    // (one AI call, not three). The 6-hour cron keeps all ranges fresh.
    const { env } = await getCloudflareContext({ async: true });
    const payloads = await regenerateAnalytics(env as CloudflareEnv, [requested]);
    const generatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      cached: false,
      generatedAt,
      ...payloads[requested],
    });
  } catch (error) {
    console.error("Admin analytics refresh error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", success: false },
      { status: 500 }
    );
  }
}
