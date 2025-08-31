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
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { eq, inArray } from "drizzle-orm";

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
    
    // If no settings exist, initialize with defaults
    if (settings.length === 0) {
      console.log('Initializing default settings...');
      await db.insert(admin_settings).values(defaultSettings);
      const newSettings = await db.select().from(admin_settings);
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