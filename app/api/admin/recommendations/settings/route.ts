import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { getDbAsync } from "@/lib/db";
import { admin_settings } from "@/lib/db/schema/settings";
import type { RecommendationSettings } from "@/lib/recommendations/types";
import { getRecommendationSettings } from "@/lib/utils/settings";

const MAX_BODY_BYTES = 2_048;

async function readSettingsBody(request: NextRequest): Promise<RecommendationSettings> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_BODY");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_BODY");
  }
  const value = body as Record<string, unknown>;
  if (
    (value.strategy !== "deterministic" && value.strategy !== "ai_batch") ||
    typeof value.personalize !== "boolean" ||
    typeof value.excludeOwned !== "boolean" ||
    typeof value.limit !== "number" ||
    !Number.isInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 6
  ) {
    throw new Error("INVALID_BODY");
  }

  return {
    strategy: value.strategy,
    personalize: value.personalize,
    excludeOwned: value.excludeOwned,
    limit: value.limit,
  };
}

export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 403 });
  }
  try {
    return NextResponse.json({ settings: await getRecommendationSettings() });
  } catch (error) {
    console.error("Recommendation settings load failed", error);
    return NextResponse.json({ error: "Failed to load recommendation settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 403 });
  }

  try {
    const settings = await readSettingsBody(request);
    const db = await getDbAsync();
    const updatedAt = new Date().toISOString();
    const updateSetting = (key: string, value: unknown) =>
      db
        .update(admin_settings)
        .set({ value: JSON.stringify(value), updated_at: updatedAt })
        .where(eq(admin_settings.key, key));
    await db.batch([
      updateSetting("recommendations.strategy", settings.strategy),
      updateSetting("recommendations.personalize", settings.personalize),
      updateSetting("recommendations.limit", settings.limit),
      updateSetting("recommendations.exclude_owned", settings.excludeOwned),
    ]);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    if (error instanceof Error && error.message === "INVALID_BODY") {
      return NextResponse.json({ error: "Invalid recommendation settings" }, { status: 400 });
    }
    console.error("Recommendation settings update failed", error);
    return NextResponse.json({ error: "Failed to update recommendation settings" }, { status: 500 });
  }
}
