/**
 * === Admin Analytics (cached read) ===
 *
 * Serves the Admin BI dashboard payload from the D1 `analytics_cache` table,
 * which is populated by a scheduled (cron) handler and the manual refresh
 * route. This keeps dashboard loads fast — the expensive data-collection +
 * Workers AI analysis no longer runs on every request.
 *
 * GET /api/admin/analytics?range=7d|30d|90d
 *   Returns the cached payload for the requested range (default "30d").
 *   If the cache is cold (no row yet), it generates that range once, stores
 *   it, and returns it.
 *
 * To force a fresh regeneration of all ranges, use
 *   POST /api/admin/analytics/refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { analytics_cache } from "@/lib/db/schema/analytics";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { eq } from "drizzle-orm";
import {
  regenerateAnalytics,
  isAnalyticsRange,
  type AnalyticsRange,
} from "@/lib/analytics/generate-insights";

export async function GET(req: NextRequest) {
  try {
    const authResult = await checkAdminPermissions(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const rangeParam = req.nextUrl.searchParams.get("range") ?? "30d";
    const range: AnalyticsRange = isAnalyticsRange(rangeParam) ? rangeParam : "30d";

    const db = await getDbAsync();
    const [row] = await db
      .select()
      .from(analytics_cache)
      .where(eq(analytics_cache.range, range));

    // Cache hit — fast path.
    if (row) {
      const payload =
        typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      return NextResponse.json({
        success: true,
        cached: true,
        generatedAt: row.generated_at,
        ...payload,
      });
    }

    // Cold cache — generate this range once, store it, and return it.
    const { env } = await getCloudflareContext({ async: true });
    const payloads = await regenerateAnalytics(env as CloudflareEnv, [range]);
    return NextResponse.json({
      success: true,
      cached: false,
      generatedAt: new Date().toISOString(),
      ...payloads[range],
    });
  } catch (error) {
    console.error("Admin analytics read error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", success: false },
      { status: 500 }
    );
  }
}
