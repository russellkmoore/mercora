/**
 * === Admin Settings Management API ===
 * 
 * Handles loading and saving of admin configuration settings including:
 * - System operations (maintenance mode, debug logging)
 * - Store configuration (shipping thresholds, tax rates)
 * - Shipping method configuration 
 * - Refund policy settings
 * - Promotions and banner management
 * 
 * Settings are stored in admin_settings table with categories for organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { admin_settings, defaultSettings } from "@/lib/db/schema/settings";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import { CUSTOM_JS_ENABLED_SETTING, logCustomJsAudit } from "@/lib/cms/custom-js-guard";
import {
  HONOR_GUARD_SETTING_CATEGORY,
  HONOR_GUARD_SETTING_KEY,
} from "@/lib/gift-cards/honor-guard";
import { eq, inArray } from "drizzle-orm";

/**
 * The gift-card honor guard is written by the five-minute cron and by nothing
 * else (D-15). This route takes an arbitrary key from the request body, so
 * without an explicit rejection any admin could upsert a zeroed measurement,
 * switch honoring off while cards still carry money, and strand every pending
 * redemption and refund until the next tick — or permanently, by dating the
 * forged record into the future.
 *
 * The `gift_cards` category now holds more than one key (D-20):
 * `gift_cards.honor_guard` (cron-owned, never writable here) and
 * `gift_cards.code_reveal_enabled` (an ordinary admin setting, D-12). The
 * guard key itself is always refused, trimmed before comparison so a padded
 * variant cannot slip through. Any *other* key in the category is refused too
 * unless it is explicitly allowlisted below — that allowlist is the only way
 * a new `gift_cards.*` setting becomes writable through this route, so a
 * future key does not silently inherit write access to the category.
 */
const WRITABLE_GIFT_CARDS_CATEGORY_KEYS = new Set<string>([
  "gift_cards.code_reveal_enabled",
]);

function writesTheHonorGuard(update: unknown): boolean {
  if (!update || typeof update !== "object") return false;
  const candidate = update as Record<string, unknown>;
  const key = typeof candidate.key === "string" ? candidate.key.trim() : candidate.key;
  if (key === HONOR_GUARD_SETTING_KEY) return true;
  if (
    candidate.category === HONOR_GUARD_SETTING_CATEGORY
    && !WRITABLE_GIFT_CARDS_CATEGORY_KEYS.has(key as string)
  ) {
    return true;
  }
  return false;
}

/**
 * GET /api/admin/settings - Load current settings
 * Optional ?category=system to load only specific category
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || "Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const db = await getDbAsync();

    // Load settings from database
    const settings = category
      ? await db.select().from(admin_settings).where(eq(admin_settings.category, category))
      : await db.select().from(admin_settings);

    // Seed any defaults that are missing for the requested scope, regardless
    // of whether other rows already exist. Gating on "which default keys are
    // absent" (rather than "did this query return any rows") means a
    // category with no defaults at all (e.g. `appearance`) is still
    // legitimate and never triggers a full-table re-seed, AND a table that's
    // already partially seeded (e.g. only `refund.*` rows from a prior
    // category-scoped call) still picks up other categories' missing
    // defaults on a later unfiltered load, instead of staying empty forever.
    const existingKeys = new Set(
      (await db.select({ key: admin_settings.key }).from(admin_settings)).map((row) => row.key)
    );
    const missingDefaults = (category
      ? defaultSettings.filter((setting) => setting.category === category)
      : defaultSettings
    ).filter((setting) => !existingKeys.has(setting.key));

    if (missingDefaults.length > 0) {
      console.log('Initializing default settings...');
      try {
        await db.insert(admin_settings).values(missingDefaults).onConflictDoNothing();
      } catch (err) {
        // Another concurrent request may have already seeded these rows;
        // re-read below regardless. Log in case this is a real failure, not
        // a race — onConflictDoNothing() already absorbs the PK-conflict
        // race this catch was originally written for, so anything reaching
        // this arm is more likely a genuine insert failure worth knowing about.
        console.error('Seed insert failed (may be a benign concurrent race):', err);
      }
    }

    if (missingDefaults.length > 0 || settings.length === 0) {
      const newSettings = category
        ? await db.select().from(admin_settings).where(eq(admin_settings.category, category))
        : await db.select().from(admin_settings);
      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings - Save/update settings
 * Body: { updates: [{ key, value, category?, description?, data_type? }] }
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || "Admin access required" },
        { status: 403 }
      );
    }

    const { updates } = await request.json() as any;
    
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    if (updates.some(writesTheHonorGuard)) {
      return NextResponse.json(
        {
          error: "The gift-card honor guard is written only by the scheduled "
            + "measurement and cannot be set through this endpoint.",
          code: "honor_guard_read_only",
        },
        { status: 400 },
      );
    }

    const customJsSettings = updates.filter((update: unknown) => {
      if (!update || typeof update !== "object") return false;
      const candidate = update as Record<string, unknown>;
      return candidate.key === CUSTOM_JS_ENABLED_SETTING;
    });
    if (customJsSettings.length > 1) {
      return NextResponse.json(
        { error: "Each setting key may be updated only once per request." },
        { status: 400 },
      );
    }
    const customJsSetting = customJsSettings[0] as Record<string, unknown> | undefined;
    const enablesCustomJs = customJsSetting?.value === true;
    if (enablesCustomJs && !(await isSuperAdminActor(authResult))) {
      return NextResponse.json(
        { error: "Only a database super-admin may enable custom JavaScript." },
        { status: 403 },
      );
    }

    const db = await getDbAsync();
    
    // Process each setting update
    for (const update of updates) {
      const { key, value, category, description, data_type } = update;
      
      if (!key || value === undefined) {
        continue; // Skip invalid updates
      }
      
      // Check if setting exists
      const existing = await db.select().from(admin_settings).where(eq(admin_settings.key, key)).limit(1);
      
      const settingData = {
        key,
        value: JSON.stringify(value),
        category: category || 'system',
        description: description || null,
        data_type: data_type || (typeof value),
        updated_at: new Date().toISOString()
      };
      
      if (existing.length > 0) {
        // Update existing setting
        await db.update(admin_settings)
          .set(settingData)
          .where(eq(admin_settings.key, key));
      } else {
        // Insert new setting
        await db.insert(admin_settings).values({
          ...settingData,
          created_at: new Date().toISOString()
        });
      }
    }
    
    // Return updated settings
    const updatedKeys = updates.map(u => u.key);
    const updatedSettings = await db.select().from(admin_settings)
      .where(inArray(admin_settings.key, updatedKeys));

    if (customJsSetting) {
      logCustomJsAudit({
        actorUserId: authResult.userId,
        action: enablesCustomJs ? "enable" : "disable",
        allowed: true,
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      updated: updatedSettings.length,
      settings: updatedSettings
    });

  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
