/**
 * MACH Alliance Open Data Model - Language Schema
 * 
 * Drizzle ORM schema for the Language utility object following the MACH Alliance standards.
 * Optimized for Cloudflare D1 database with JSON storage for complex objects.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/language.md
 */

import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { 
  MACHLanguage, 
  MACHLocaleFormatting,
  MACHNumberFormatting,
  MACHCurrencyFormatting
} from "../../types/mach/Language";

/**
 * Language table schema
 * 
 * Standardized utility object for representing languages, locales, and regional
 * variations supporting internationalization (i18n) and localization (l10n).
 */
export const languages = sqliteTable("languages", {
  // Core identification - REQUIRED
  code: text("code").primaryKey(), // ISO 639-1 language code (e.g., "en", "es", "fr")
  name: text("name", { mode: "json" }).$type<string | Record<string, string>>().notNull(), // Language name
  locale: text("locale").notNull(), // Full locale identifier (e.g., "en-US", "es-MX")
  
  // Regional and script information - OPTIONAL
  region: text("region"), // ISO 3166-1 alpha-2 region/country code
  script: text("script"), // ISO 15924 script code (e.g., "Latn", "Cyrl", "Arab", "Hans")
  direction: text("direction", { enum: ["ltr", "rtl"] }).default("ltr"), // Text direction
  status: text("status", { 
    enum: ["active", "inactive", "deprecated", "experimental"] 
  }).default("active"),
  
  // External references - OPTIONAL
  externalReferences: text("external_references", { mode: "json" }).$type<Record<string, string>>(),
  
  // Timestamps - OPTIONAL
  createdAt: text("created_at"), // ISO 8601 creation timestamp
  updatedAt: text("updated_at"), // ISO 8601 update timestamp
  
  // Formatting and localization - OPTIONAL
  formatting: text("formatting", { mode: "json" }).$type<MACHLocaleFormatting>(),
  fallbackLocales: text("fallback_locales", { mode: "json" }).$type<string[]>(),
  
  // Extensions for custom data - OPTIONAL
  extensions: text("extensions", { mode: "json" }).$type<Record<string, any>>(),
});

/**
 * Transform MACH Language to database record
 */
export function transformFromMACHLanguage(machLanguage: MACHLanguage): typeof languages.$inferInsert {
  return {
    code: machLanguage.code,
    name: machLanguage.name,
    locale: machLanguage.locale,
    region: machLanguage.region,
    script: machLanguage.script,
    direction: machLanguage.direction || "ltr",
    status: machLanguage.status || "active",
    externalReferences: machLanguage.external_references,
    createdAt: machLanguage.created_at,
    updatedAt: machLanguage.updated_at,
    formatting: machLanguage.formatting,
    fallbackLocales: machLanguage.fallback_locales,
    extensions: machLanguage.extensions,
  };
}

/**
 * Transform database record to MACH Language
 */
export function transformToMACHLanguage(record: typeof languages.$inferSelect): MACHLanguage {
  return {
    code: record.code,
    name: record.name,
    locale: record.locale,
    region: record.region || undefined,
    script: record.script || undefined,
    direction: record.direction || "ltr",
    status: record.status || "active",
    external_references: record.externalReferences || undefined,
    created_at: record.createdAt || undefined,
    updated_at: record.updatedAt || undefined,
    formatting: record.formatting || undefined,
    fallback_locales: record.fallbackLocales || undefined,
    extensions: record.extensions || undefined,
  };
}

/**
 * Validate language code according to ISO 639 standards
 */
export function validateLanguageCode(code: string): boolean {
  // ISO 639-1 (2-letter) or ISO 639-2/639-3 (3-letter)
  return /^[a-z]{2,3}$/.test(code);
}

/**
 * Validate locale according to BCP 47 standards
 */
export function validateLocale(locale: string): boolean {
  // BCP 47 format: language-script-region (script and region optional)
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(locale);
}

/**
 * Validate region code according to ISO 3166-1 alpha-2 standards
 */
export function validateRegionCode(region: string): boolean {
  return /^[A-Z]{2}$/.test(region);
}

/**
 * Validate script code according to ISO 15924 standards
 */
export function validateScriptCode(script: string): boolean {
  return /^[A-Z][a-z]{3}$/.test(script);
}

/**
 * Validate currency code according to ISO 4217 standards
 */
export function validateCurrencyCode(currencyCode: string): boolean {
  return /^[A-Z]{3}$/.test(currencyCode);
}

/**
 * Extract language code from locale
 */
export function extractLanguageFromLocale(locale: string): string {
  return locale.split('-')[0];
}

/**
 * Extract region code from locale
 */
export function extractRegionFromLocale(locale: string): string | undefined {
  const parts = locale.split('-');
  // Look for 2-letter uppercase region code
  return parts.find(part => /^[A-Z]{2}$/.test(part));
}

/**
 * Extract script code from locale
 */
export function extractScriptFromLocale(locale: string): string | undefined {
  const parts = locale.split('-');
  // Look for 4-letter script code (first letter uppercase, rest lowercase)
  return parts.find(part => /^[A-Z][a-z]{3}$/.test(part));
}

/**
 * Build locale from components
 */
export function buildLocale(language: string, script?: string, region?: string): string {
  let locale = language;
  if (script) locale += `-${script}`;
  if (region) locale += `-${region}`;
  return locale;
}

/**
 * Check if language is RTL (Right-to-Left)
 */
export function isRTLLanguage(languageCode: string): boolean {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'ku', 'ps'];
  return rtlLanguages.includes(languageCode.toLowerCase());
}

/**
 * Get default direction for language
 */
export function getDefaultDirection(languageCode: string): "ltr" | "rtl" {
  return isRTLLanguage(languageCode) ? "rtl" : "ltr";
}

/**
 * Check if language uses CJK script (Chinese, Japanese, Korean)
 */
export function isCJKLanguage(languageCode: string): boolean {
  const cjkLanguages = ['zh', 'ja', 'ko'];
  return cjkLanguages.includes(languageCode.toLowerCase());
}

/**
 * Check if script requires complex text shaping
 */
export function requiresTextShaping(script?: string): boolean {
  if (!script) return false;
  const shapingScripts = ['Arab', 'Hebr', 'Deva', 'Beng', 'Thai', 'Laoo', 'Mymr'];
  return shapingScripts.includes(script);
}

/**
 * Get measurement system default for region
 */
export function getDefaultMeasurementSystem(region?: string): "metric" | "imperial" {
  const imperialRegions = ['US', 'LR', 'MM']; // United States, Liberia, Myanmar
  return region && imperialRegions.includes(region) ? "imperial" : "metric";
}

/**
 * Get first day of week default for region
 */
export function getDefaultFirstDayOfWeek(region?: string): number {
  // 0 = Sunday, 1 = Monday, etc.
  const sundayFirstRegions = ['US', 'CA', 'IL', 'JP', 'TW', 'HK', 'MO', 'IN', 'PH'];
  return region && sundayFirstRegions.includes(region) ? 0 : 1;
}

/**
 * Generate default formatting for locale
 */
export function generateDefaultFormatting(
  languageCode: string, 
  region?: string, 
  script?: string
): MACHLocaleFormatting {
  const isUS = region === 'US';
  const isGB = region === 'GB';
  const isMetric = getDefaultMeasurementSystem(region) === 'metric';
  const firstDayOfWeek = getDefaultFirstDayOfWeek(region);
  
  // Default number formatting
  const numberFormat: MACHNumberFormatting = {
    decimal_separator: ".",
    thousands_separator: ",",
    decimal_places: 2,
    grouping: [3]
  };
  
  // Region-specific adjustments
  if (region === 'DE' || region === 'FR' || region === 'ES') {
    numberFormat.decimal_separator = ",";
    numberFormat.thousands_separator = ".";
  }
  
  // Default currency formatting
  const currencyFormat: MACHCurrencyFormatting = {
    symbol: "$",
    code: "USD",
    position: "before",
    spacing: false,
    decimal_places: 2
  };
  
  // Region-specific currency defaults
  if (region) {
    const regionCurrencies: Record<string, { symbol: string; code: string; position?: "before" | "after"; spacing?: boolean }> = {
      'US': { symbol: '$', code: 'USD' },
      'CA': { symbol: 'C$', code: 'CAD' },
      'GB': { symbol: '£', code: 'GBP' },
      'EU': { symbol: '€', code: 'EUR', position: 'after', spacing: true },
      'DE': { symbol: '€', code: 'EUR', position: 'after', spacing: true },
      'FR': { symbol: '€', code: 'EUR', position: 'after', spacing: true },
      'ES': { symbol: '€', code: 'EUR', position: 'after', spacing: true },
      'IT': { symbol: '€', code: 'EUR', position: 'after', spacing: true },
      'JP': { symbol: '¥', code: 'JPY', position: 'before', spacing: false },
      'CN': { symbol: '¥', code: 'CNY', position: 'before', spacing: false },
      'KR': { symbol: '₩', code: 'KRW', position: 'before', spacing: false },
      'IN': { symbol: '₹', code: 'INR', position: 'before', spacing: false },
      'MX': { symbol: '$', code: 'MXN', position: 'before', spacing: true },
      'BR': { symbol: 'R$', code: 'BRL', position: 'before', spacing: true },
      'SA': { symbol: 'ر.س', code: 'SAR', position: 'after', spacing: true },
      'RU': { symbol: '₽', code: 'RUB', position: 'after', spacing: true }
    };
    
    const regionCurrency = regionCurrencies[region];
    if (regionCurrency) {
      Object.assign(currencyFormat, regionCurrency);
    }
  }
  
  return {
    date_format: isUS ? "MM/dd/yyyy" : "dd/MM/yyyy",
    time_format: isUS ? "h:mm a" : "HH:mm",
    date_time_format: isUS ? "MM/dd/yyyy h:mm a" : "dd/MM/yyyy HH:mm",
    first_day_of_week: firstDayOfWeek,
    number_format: numberFormat,
    currency_format: currencyFormat,
    measurement_system: isMetric ? "metric" : "imperial"
  };
}

// Type exports for easier use
export type LanguageRecord = typeof languages.$inferSelect;
export type LanguageInsert = typeof languages.$inferInsert;
