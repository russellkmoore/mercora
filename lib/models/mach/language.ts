/**
 * MACH Alliance Open Data Model - Language Business Operations
 * 
 * Comprehensive business logic layer for Language utility object operations.
 * Supports internationalization (i18n) and localization (l10n) with formatting rules,
 * fallback strategies, and locale management.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/language.md
 */

import { and, eq, inArray, sql, desc, asc } from "drizzle-orm";
import { getDbAsync } from "../../db";
import { languages, type LanguageRecord, type LanguageInsert } from "../../db/schema/language";
import type { 
  MACHLanguage, 
  MACHLocaleFormatting,
  MACHNumberFormatting,
  MACHCurrencyFormatting 
} from "../../types/mach/Language";
import { 
  transformFromMACHLanguage, 
  transformToMACHLanguage,
  validateLanguageCode,
  validateLocale,
  validateRegionCode,
  validateScriptCode,
  generateDefaultFormatting,
  extractLanguageFromLocale,
  extractRegionFromLocale,
  extractScriptFromLocale,
  buildLocale,
  getDefaultDirection,
  isRTLLanguage,
  isCJKLanguage
} from "../../db/schema/language";

// ====================================
// Core Language Operations
// ====================================

/**
 * Create a new language entry
 */
export async function createLanguage(
  languageData: Partial<MACHLanguage> & Pick<MACHLanguage, 'code' | 'name' | 'locale'>
): Promise<MACHLanguage> {
  // Validate required fields
  if (!validateLanguageCode(languageData.code)) {
    throw new Error(`Invalid language code format: ${languageData.code}`);
  }
  
  if (!validateLocale(languageData.locale)) {
    throw new Error(`Invalid locale format: ${languageData.locale}`);
  }

  // Validate region if provided
  if (languageData.region && !validateRegionCode(languageData.region)) {
    throw new Error(`Invalid region code format: ${languageData.region}`);
  }

  // Validate script if provided
  if (languageData.script && !validateScriptCode(languageData.script)) {
    throw new Error(`Invalid script code format: ${languageData.script}`);
  }

  // Generate defaults
  const languageFromLocale = extractLanguageFromLocale(languageData.locale);
  const regionFromLocale = extractRegionFromLocale(languageData.locale);
  const scriptFromLocale = extractScriptFromLocale(languageData.locale);
  
  const now = new Date().toISOString();
  const language: MACHLanguage = {
    code: languageData.code,
    name: languageData.name,
    locale: languageData.locale,
    region: languageData.region || regionFromLocale,
    script: languageData.script || scriptFromLocale,
    direction: languageData.direction || getDefaultDirection(languageFromLocale),
    status: languageData.status || 'active',
    external_references: languageData.external_references,
    created_at: now,
    updated_at: now,
    formatting: languageData.formatting || generateDefaultFormatting(
      languageFromLocale, 
      languageData.region || regionFromLocale, 
      languageData.script || scriptFromLocale
    ),
    fallback_locales: languageData.fallback_locales,
    extensions: languageData.extensions,
  };

  const record = transformFromMACHLanguage(language);
  
  try {
    const db = await getDbAsync();
    await db.insert(languages).values(record);
    return language;
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Language with code '${languageData.code}' or locale '${languageData.locale}' already exists`);
    }
    throw error;
  }
}

/**
 * Get language by code
 */
export async function getLanguageByCode(code: string): Promise<MACHLanguage | null> {
  const db = await getDbAsync();
  const records = await db
    .select()
    .from(languages)
    .where(eq(languages.code, code))
    .limit(1);

  return records.length > 0 ? transformToMACHLanguage(records[0]) : null;
}

/**
 * Get language by locale
 */
export async function getLanguageByLocale(locale: string): Promise<MACHLanguage | null> {
  const db = await getDbAsync();
  const records = await db
    .select()
    .from(languages)
    .where(eq(languages.locale, locale))
    .limit(1);

  return records.length > 0 ? transformToMACHLanguage(records[0]) : null;
}

/**
 * Update language information
 */
export async function updateLanguage(
  code: string,
  updates: Partial<Omit<MACHLanguage, 'code' | 'created_at'>>
): Promise<MACHLanguage | null> {
  // Validate updates
  if (updates.locale && !validateLocale(updates.locale)) {
    throw new Error(`Invalid locale format: ${updates.locale}`);
  }
  
  if (updates.region && !validateRegionCode(updates.region)) {
    throw new Error(`Invalid region code format: ${updates.region}`);
  }

  if (updates.script && !validateScriptCode(updates.script)) {
    throw new Error(`Invalid script code format: ${updates.script}`);
  }

  const existing = await getLanguageByCode(code);
  if (!existing) {
    return null;
  }

  const updated: MACHLanguage = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const record = transformFromMACHLanguage(updated);
  
  const db = await getDbAsync();
  await db
    .update(languages)
    .set(record)
    .where(eq(languages.code, code));

  return updated;
}

/**
 * Delete language
 */
export async function deleteLanguage(code: string): Promise<boolean> {
  const db = await getDbAsync();
  await db
    .delete(languages)
    .where(eq(languages.code, code));

  return true;
}

/**
 * List all languages with optional filtering
 */
export async function listLanguages(options?: {
  status?: MACHLanguage['status'];
  direction?: MACHLanguage['direction'];
  region?: string;
  script?: string;
  limit?: number;
  offset?: number;
}): Promise<MACHLanguage[]> {
  const db = await getDbAsync();
  let query = db.select().from(languages);

  // Apply filters
  const conditions = [];
  
  if (options?.status) {
    conditions.push(eq(languages.status, options.status));
  }
  
  if (options?.direction) {
    conditions.push(eq(languages.direction, options.direction));
  }
  
  if (options?.region) {
    conditions.push(eq(languages.region, options.region));
  }
  
  if (options?.script) {
    conditions.push(eq(languages.script, options.script));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Apply ordering and pagination
  query = query.orderBy(asc(languages.code)) as typeof query;
  
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const records = await query;
  return records.map(transformToMACHLanguage);
}

// ====================================
// Locale and Formatting Operations
// ====================================

/**
 * Get available locales for a language
 */
export async function getLocalesForLanguage(languageCode: string): Promise<string[]> {
  const db = await getDbAsync();
  const records = await db
    .select({ locale: languages.locale })
    .from(languages)
    .where(eq(languages.code, languageCode))
    .orderBy(asc(languages.locale));

  return records.map((r: { locale: string }) => r.locale);
}

/**
 * Get languages for a specific region
 */
export async function getLanguagesForRegion(region: string): Promise<MACHLanguage[]> {
  if (!validateRegionCode(region)) {
    throw new Error(`Invalid region code format: ${region}`);
  }

  const db = await getDbAsync();
  const records = await db
    .select()
    .from(languages)
    .where(and(
      eq(languages.region, region),
      eq(languages.status, 'active')
    ))
    .orderBy(asc(languages.code));

  return records.map(transformToMACHLanguage);
}

/**
 * Get RTL (Right-to-Left) languages
 */
export async function getRTLLanguages(): Promise<MACHLanguage[]> {
  const db = await getDbAsync();
  const records = await db
    .select()
    .from(languages)
    .where(and(
      eq(languages.direction, 'rtl'),
      eq(languages.status, 'active')
    ))
    .orderBy(asc(languages.code));

  return records.map(transformToMACHLanguage);
}

/**
 * Get languages using a specific script
 */
export async function getLanguagesByScript(script: string): Promise<MACHLanguage[]> {
  if (!validateScriptCode(script)) {
    throw new Error(`Invalid script code format: ${script}`);
  }

  const db = await getDbAsync();
  const records = await db
    .select()
    .from(languages)
    .where(and(
      eq(languages.script, script),
      eq(languages.status, 'active')
    ))
    .orderBy(asc(languages.code));

  return records.map(transformToMACHLanguage);
}

// ====================================
// Internationalization Utilities
// ====================================

/**
 * Resolve best locale match from available locales
 */
export async function resolveLocale(
  requestedLocale: string, 
  fallbackToLanguageOnly: boolean = true
): Promise<MACHLanguage | null> {
  // First try exact match
  let language = await getLanguageByLocale(requestedLocale);
  if (language) {
    return language;
  }

  if (fallbackToLanguageOnly) {
    // Try language code only
    const languageCode = extractLanguageFromLocale(requestedLocale);
    const db = await getDbAsync();
    const languagesForCode = await db
      .select()
      .from(languages)
      .where(and(
        eq(languages.code, languageCode),
        eq(languages.status, 'active')
      ))
      .orderBy(asc(languages.locale))
      .limit(1);

    if (languagesForCode.length > 0) {
      return transformToMACHLanguage(languagesForCode[0]);
    }
  }

  return null;
}

/**
 * Get fallback chain for a locale
 */
export async function getFallbackChain(locale: string): Promise<MACHLanguage[]> {
  const language = await getLanguageByLocale(locale);
  if (!language) {
    return [];
  }

  const chain: MACHLanguage[] = [language];
  
  // Add explicit fallback locales
  if (language.fallback_locales) {
    for (const fallbackLocale of language.fallback_locales) {
      const fallbackLanguage = await getLanguageByLocale(fallbackLocale);
      if (fallbackLanguage && !chain.find(l => l.locale === fallbackLanguage.locale)) {
        chain.push(fallbackLanguage);
      }
    }
  }

  // Add language-only fallback if not already present
  const languageCode = extractLanguageFromLocale(locale);
  if (!chain.find(l => l.code === languageCode && l.locale === languageCode)) {
    const baseLanguage = await getLanguageByCode(languageCode);
    if (baseLanguage && !chain.find(l => l.locale === baseLanguage.locale)) {
      chain.push(baseLanguage);
    }
  }

  return chain;
}

/**
 * Update formatting rules for a language
 */
export async function updateLanguageFormatting(
  code: string,
  formatting: Partial<MACHLocaleFormatting>
): Promise<MACHLanguage | null> {
  const existing = await getLanguageByCode(code);
  if (!existing) {
    return null;
  }

  const updatedFormatting: MACHLocaleFormatting = {
    ...existing.formatting,
    ...formatting,
  };

  return updateLanguage(code, { formatting: updatedFormatting });
}

/**
 * Add fallback locale to a language
 */
export async function addFallbackLocale(
  code: string,
  fallbackLocale: string
): Promise<MACHLanguage | null> {
  const existing = await getLanguageByCode(code);
  if (!existing) {
    return null;
  }

  // Verify fallback locale exists
  const fallbackLanguage = await getLanguageByLocale(fallbackLocale);
  if (!fallbackLanguage) {
    throw new Error(`Fallback locale '${fallbackLocale}' does not exist`);
  }

  const fallbackLocales = existing.fallback_locales || [];
  if (!fallbackLocales.includes(fallbackLocale)) {
    fallbackLocales.push(fallbackLocale);
  }

  return updateLanguage(code, { fallback_locales: fallbackLocales });
}

/**
 * Remove fallback locale from a language
 */
export async function removeFallbackLocale(
  code: string,
  fallbackLocale: string
): Promise<MACHLanguage | null> {
  const existing = await getLanguageByCode(code);
  if (!existing) {
    return null;
  }

  const fallbackLocales = (existing.fallback_locales || [])
    .filter(locale => locale !== fallbackLocale);

  return updateLanguage(code, { 
    fallback_locales: fallbackLocales.length > 0 ? fallbackLocales : undefined 
  });
}

// ====================================
// Formatting Utilities
// ====================================

/**
 * Format number according to language formatting rules
 */
export function formatNumber(
  value: number,
  formatting?: MACHNumberFormatting
): string {
  if (!formatting) {
    return value.toString();
  }

  const {
    decimal_separator = ".",
    thousands_separator = ",",
    decimal_places = 2,
    grouping = [3]
  } = formatting;

  // Split integer and decimal parts
  const parts = value.toFixed(decimal_places).split(".");
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Apply grouping to integer part
  if (thousands_separator && grouping.length > 0) {
    const groupSize = grouping[0];
    const regex = new RegExp(`\\d(?=(\\d{${groupSize}})+$)`, 'g');
    integerPart = integerPart.replace(regex, `$&${thousands_separator}`);
  }

  // Combine parts
  if (decimal_places > 0 && decimalPart) {
    return `${integerPart}${decimal_separator}${decimalPart}`;
  }

  return integerPart;
}

/**
 * Format currency according to language formatting rules
 */
export function formatCurrency(
  amount: number,
  formatting?: MACHCurrencyFormatting
): string {
  if (!formatting) {
    return amount.toString();
  }

  const {
    symbol = "$",
    position = "before",
    spacing = false,
    decimal_places = 2
  } = formatting;

  // Format the number part
  const numberFormat: MACHNumberFormatting = {
    decimal_separator: ".",
    thousands_separator: ",",
    decimal_places,
    grouping: [3]
  };

  const formattedNumber = formatNumber(amount, numberFormat);
  const space = spacing ? " " : "";

  // Apply currency symbol positioning
  if (position === "before") {
    return `${symbol}${space}${formattedNumber}`;
  } else {
    return `${formattedNumber}${space}${symbol}`;
  }
}

/**
 * Format date according to language formatting rules
 */
export function formatDate(
  date: Date,
  dateFormat: string = "yyyy-MM-dd"
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return dateFormat
    .replace(/yyyy/g, year.toString())
    .replace(/MM/g, month)
    .replace(/dd/g, day);
}

/**
 * Format time according to language formatting rules
 */
export function formatTime(
  date: Date,
  timeFormat: string = "HH:mm"
): string {
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (timeFormat.includes('a') || timeFormat.includes('A')) {
    // 12-hour format with AM/PM
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 < 12 ? 'AM' : 'PM';
    
    return timeFormat
      .replace(/h/g, hours12.toString())
      .replace(/mm/g, minutes)
      .replace(/ss/g, seconds)
      .replace(/a/gi, ampm);
  } else {
    // 24-hour format
    const hours24Str = String(hours24).padStart(2, '0');
    
    return timeFormat
      .replace(/HH/g, hours24Str)
      .replace(/mm/g, minutes)
      .replace(/ss/g, seconds);
  }
}

// ====================================
// Language Status Management
// ====================================

/**
 * Activate a language
 */
export async function activateLanguage(code: string): Promise<MACHLanguage | null> {
  return updateLanguage(code, { 
    status: 'active',
    updated_at: new Date().toISOString()
  });
}

/**
 * Deactivate a language
 */
export async function deactivateLanguage(code: string): Promise<MACHLanguage | null> {
  return updateLanguage(code, { 
    status: 'inactive',
    updated_at: new Date().toISOString()
  });
}

/**
 * Mark language as deprecated
 */
export async function deprecateLanguage(code: string): Promise<MACHLanguage | null> {
  return updateLanguage(code, { 
    status: 'deprecated',
    updated_at: new Date().toISOString()
  });
}

/**
 * Get active languages only
 */
export async function getActiveLanguages(): Promise<MACHLanguage[]> {
  return listLanguages({ status: 'active' });
}

/**
 * Check if language is active
 */
export async function isLanguageActive(code: string): Promise<boolean> {
  const language = await getLanguageByCode(code);
  return language?.status === 'active';
}

/**
 * Get language statistics
 */
export async function getLanguageStatistics(): Promise<{
  total: number;
  active: number;
  inactive: number;
  deprecated: number;
  experimental: number;
  rtl_count: number;
  regions: number;
  scripts: number;
}> {
  const db = await getDbAsync();
  const allRecords = await db.select().from(languages);
  
  const total = allRecords.length;
  const active = allRecords.filter((r: LanguageRecord) => r.status === 'active').length;
  const inactive = allRecords.filter((r: LanguageRecord) => r.status === 'inactive').length;
  const deprecated = allRecords.filter((r: LanguageRecord) => r.status === 'deprecated').length;
  const experimental = allRecords.filter((r: LanguageRecord) => r.status === 'experimental').length;
  const rtl_count = allRecords.filter((r: LanguageRecord) => r.direction === 'rtl').length;
  
  const uniqueRegions = new Set(allRecords.map((r: LanguageRecord) => r.region).filter(Boolean));
  const uniqueScripts = new Set(allRecords.map((r: LanguageRecord) => r.script).filter(Boolean));
  
  return {
    total,
    active,
    inactive,
    deprecated,
    experimental,
    rtl_count,
    regions: uniqueRegions.size,
    scripts: uniqueScripts.size,
  };
}

// ====================================
// Bulk Operations
// ====================================

/**
 * Create multiple languages
 */
export async function createLanguages(
  languagesData: (Partial<MACHLanguage> & Pick<MACHLanguage, 'code' | 'name' | 'locale'>)[]
): Promise<MACHLanguage[]> {
  const createdLanguages: MACHLanguage[] = [];
  
  for (const languageData of languagesData) {
    try {
      const created = await createLanguage(languageData);
      createdLanguages.push(created);
    } catch (error) {
      console.error(`Failed to create language ${languageData.code}:`, error);
      // Continue with other languages
    }
  }
  
  return createdLanguages;
}

/**
 * Update multiple languages
 */
export async function updateLanguages(
  updates: { code: string; data: Partial<Omit<MACHLanguage, 'code' | 'created_at'>> }[]
): Promise<MACHLanguage[]> {
  const updatedLanguages: MACHLanguage[] = [];
  
  for (const { code, data } of updates) {
    const updated = await updateLanguage(code, data);
    if (updated) {
      updatedLanguages.push(updated);
    }
  }
  
  return updatedLanguages;
}

/**
 * Delete multiple languages
 */
export async function deleteLanguages(codes: string[]): Promise<number> {
  const db = await getDbAsync();
  await db
    .delete(languages)
    .where(inArray(languages.code, codes));

  return codes.length; // Return number of languages we attempted to delete
}
