import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { rebuildProductRecommendations } from "@/lib/recommendations/batch/rebuild";

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminPermissions(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.error || "Admin access required" },
        { status: 403 },
      );
    }

    const startedAt = Date.now();
    const { env } = await getCloudflareContext({ async: true });
    const summary = await rebuildProductRecommendations(env);
    return NextResponse.json({
      success: summary.errors.length === 0,
      durationMs: Date.now() - startedAt,
      ...summary,
    });
  } catch (error) {
    console.error("Recommendations rebuild route failed", error);
    return NextResponse.json(
      { error: "Failed to rebuild recommendations" },
      { status: 500 },
    );
  }
}
