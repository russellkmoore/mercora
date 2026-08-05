/**
 * === Admin Analytics Refresh ===
 *
 * Manually regenerates the Admin BI dashboard payload for all time ranges and
 * upserts them into the D1 `analytics_cache` table. This runs the exact same
 * generator (`regenerateAnalytics`) that the scheduled cron handler uses, so
 * the "Refresh" button and the cron produce identical output.
 *
 * POST /api/admin/analytics/refresh
 *   Body (optional): { "range": "7d" | "30d" | "90d" }
 *     - If omitted, all ranges are regenerated.
 *   Returns the fresh payload for the requested range (or "30d" by default).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import {
  regenerateAnalytics,
  isAnalyticsRange,
  ANALYTICS_RANGES,
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

    // Regenerate everything so cron and manual refresh keep all ranges in sync.
    const { env } = await getCloudflareContext({ async: true });
    const payloads = await regenerateAnalytics(env as CloudflareEnv, ANALYTICS_RANGES);
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
