/**
 * MACH Alliance Open Data Model - Language
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/utilities/language.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

/**
 * MACH Alliance Open Data Model - Language Utility Object v1.0
 * 
 * A standardized utility object for representing languages, locales, and regional
 * variations. Supports internationalization (i18n) and localization (l10n).
 */
export interface MACHLanguage {
  // Core identification - REQUIRED
  code: string; // ISO 639-1 language code (e.g., "en", "es", "fr")
  name: string | Record<string, string>; // Language name in the language itself
  locale: string; // Full locale identifier (e.g., "en-US", "es-MX")

  // Regional and script information - OPTIONAL
  region?: string; // ISO 3166-1 alpha-2 region/country code
  script?: string; // ISO 15924 script code (e.g., "Latn", "Cyrl", "Arab", "Hans")
  direction?: "ltr" | "rtl"; // Text direction
  status?: "active" | "inactive" | "deprecated" | "experimental";

  // External references - OPTIONAL
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601 creation timestamp
  updated_at?: string; // ISO 8601 update timestamp

  // Formatting and localization - OPTIONAL
  formatting?: MACHLocaleFormatting;
  fallback_locales?: string[]; // Ordered array of fallback locales

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Locale-specific formatting rules
 */
export interface MACHLocaleFormatting {
  date_format?: string; // Date format pattern (e.g., "MM/dd/yyyy" or "dd/MM/yyyy")
  time_format?: string; // Time format pattern (e.g., "h:mm a" or "HH:mm")
  date_time_format?: string; // Combined date-time format pattern
  first_day_of_week?: number; // First day of week (0=Sunday, 1=Monday)
  number_format?: MACHNumberFormatting;
  currency_format?: MACHCurrencyFormatting;
  measurement_system?: "metric" | "imperial";
}

/**
 * Number formatting rules
 */
export interface MACHNumberFormatting {
  decimal_separator?: string; // Decimal separator character ("." or ",")
  thousands_separator?: string; // Thousands separator character ("," or ".")
  decimal_places?: number; // Default decimal places
  grouping?: number[]; // Digit grouping pattern (e.g., [3] for 1,000,000)
}

/**
 * Currency formatting rules
 */
export interface MACHCurrencyFormatting {
  symbol?: string; // Default currency symbol ("$", "€", "£")
  code?: string; // Default ISO 4217 currency code ("USD", "EUR", "GBP")
  position?: "before" | "after"; // Symbol position relative to amount
  spacing?: boolean; // Space between symbol and amount
  decimal_places?: number; // Currency-specific decimal places
}

// Type guards for language discrimination

export function isActiveLanguage(language: MACHLanguage): boolean {
  return language.status === "active" || language.status === undefined;
}

export function isRTLLanguage(language: MACHLanguage): boolean {
  return language.direction === "rtl";
}

export function isLTRLanguage(language: MACHLanguage): boolean {
  return language.direction === "ltr" || language.direction === undefined;
}

export function hasRegion(language: MACHLanguage): boolean {
  return language.region !== undefined;
}

export function hasScript(language: MACHLanguage): boolean {
  return language.script !== undefined;
}

export function hasFormatting(language: MACHLanguage): boolean {
  return language.formatting !== undefined;
}

export function hasFallbacks(language: MACHLanguage): boolean {
  return language.fallback_locales !== undefined && language.fallback_locales.length > 0;
}

// Sample objects for reference

/**
 * Sample minimal language
 */
export const sampleMinimalLanguage: MACHLanguage = {
  code: "en",
  name: "English",
  locale: "en-US"
};

/**
 * Sample English (US)
 */
export const sampleEnglishUS: MACHLanguage = {
  code: "en",
  name: "English",
  locale: "en-US",
  region: "US",
  script: "Latn",
  direction: "ltr",
  status: "active",
  external_references: {
    iso_639_1: "en",
    iso_639_2: "eng",
    iso_639_3: "eng",
    iso_3166: "US",
    bcp_47: "en-US"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  formatting: {
    date_format: "MM/dd/yyyy",
    time_format: "h:mm a",
    date_time_format: "MM/dd/yyyy h:mm a",
    first_day_of_week: 0,
    number_format: {
      decimal_separator: ".",
      thousands_separator: ",",
      decimal_places: 2,
      grouping: [3]
    },
    currency_format: {
      symbol: "$",
      code: "USD",
      position: "before",
      spacing: false,
      decimal_places: 2
    },
    measurement_system: "imperial"
  },
  fallback_locales: ["en"],
  extensions: {
    seo: {
      hreflang: "en-US",
      canonical_locale: true
    },
    translation: {
      coverage: 1.0,
      is_source: true,
      last_updated: "2024-01-01"
    },
    analytics: {
      language_code: "en",
      region_code: "US",
      usage_rank: 1
    }
  }
};

/**
 * Sample Spanish (Mexico)
 */
export const sampleSpanishMX: MACHLanguage = {
  code: "es",
  name: "Español",
  locale: "es-MX",
  region: "MX",
  script: "Latn",
  direction: "ltr",
  status: "active",
  external_references: {
    iso_639_1: "es",
    iso_639_2: "spa",
    iso_3166: "MX",
    bcp_47: "es-MX"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  formatting: {
    date_format: "dd/MM/yyyy",
    time_format: "HH:mm",
    date_time_format: "dd/MM/yyyy HH:mm",
    first_day_of_week: 1,
    number_format: {
      decimal_separator: ".",
      thousands_separator: ",",
      decimal_places: 2,
      grouping: [3]
    },
    currency_format: {
      symbol: "$",
      code: "MXN",
      position: "before",
      spacing: true,
      decimal_places: 2
    },
    measurement_system: "metric"
  },
  fallback_locales: ["es", "en"],
  extensions: {
    seo: {
      hreflang: "es-MX",
      alternate_codes: ["es-419"]
    },
    translation: {
      coverage: 0.98,
      parent_locale: "es",
      last_updated: "2024-06-15"
    },
    regional: {
      date_notation: "little-endian",
      decimal_notation: "comma-decimal",
      phone_format: "+52 (###) ###-####"
    }
  }
};

/**
 * Sample Arabic (Saudi Arabia) - RTL example
 */
export const sampleArabicSA: MACHLanguage = {
  code: "ar",
  name: {
    ar: "العربية",
    en: "Arabic"
  },
  locale: "ar-SA",
  region: "SA",
  script: "Arab",
  direction: "rtl",
  status: "active",
  external_references: {
    iso_639_1: "ar",
    iso_639_2: "ara",
    iso_639_3: "arb",
    iso_3166: "SA",
    bcp_47: "ar-SA"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  formatting: {
    date_format: "dd/MM/yyyy",
    time_format: "HH:mm",
    date_time_format: "dd/MM/yyyy HH:mm",
    first_day_of_week: 6, // Saturday
    number_format: {
      decimal_separator: ".",
      thousands_separator: ",",
      decimal_places: 2,
      grouping: [3]
    },
    currency_format: {
      symbol: "ر.س",
      code: "SAR",
      position: "after",
      spacing: true,
      decimal_places: 2
    },
    measurement_system: "metric"
  },
  fallback_locales: ["ar", "en"],
  extensions: {
    seo: {
      hreflang: "ar-SA",
      canonical_arabic: true
    },
    translation: {
      coverage: 0.95,
      parent_locale: "ar",
      last_updated: "2024-06-01"
    },
    calendar: {
      primary: "gregorian",
      secondary: "islamic-umalqura",
      weekend_days: [5, 6] // Friday, Saturday
    },
    typography: {
      font_family: "Noto Sans Arabic",
      line_height_multiplier: 1.5,
      requires_shaping: true
    }
  }
};

/**
 * Sample Chinese (Simplified)
 */
export const sampleChineseCN: MACHLanguage = {
  code: "zh",
  name: {
    zh: "中文",
    en: "Chinese"
  },
  locale: "zh-CN",
  region: "CN",
  script: "Hans",
  direction: "ltr",
  status: "active",
  external_references: {
    iso_639_1: "zh",
    iso_639_2: "zho",
    iso_639_3: "cmn",
    iso_3166: "CN",
    bcp_47: "zh-Hans-CN"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  formatting: {
    date_format: "yyyy-MM-dd",
    time_format: "HH:mm",
    date_time_format: "yyyy-MM-dd HH:mm",
    first_day_of_week: 1, // Monday
    number_format: {
      decimal_separator: ".",
      thousands_separator: ",",
      decimal_places: 2,
      grouping: [3]
    },
    currency_format: {
      symbol: "¥",
      code: "CNY",
      position: "before",
      spacing: false,
      decimal_places: 2
    },
    measurement_system: "metric"
  },
  fallback_locales: ["zh-TW", "en"],
  extensions: {
    seo: {
      hreflang: "zh-CN",
      alternate_tags: ["zh-Hans"]
    },
    translation: {
      coverage: 0.99,
      is_simplified: true,
      last_updated: "2024-07-01"
    },
    input_method: {
      primary: "pinyin",
      alternatives: ["wubi", "stroke"]
    },
    typography: {
      font_family: "Noto Sans CJK SC",
      line_height_multiplier: 1.4,
      character_width: "fullwidth"
    }
  }
};

/**
 * Sample English (UK)
 */
export const sampleEnglishGB: MACHLanguage = {
  code: "en",
  name: "English",
  locale: "en-GB",
  region: "GB",
  script: "Latn",
  direction: "ltr",
  status: "active",
  external_references: {
    iso_639_1: "en",
    iso_639_2: "eng",
    iso_3166: "GB",
    bcp_47: "en-GB"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  formatting: {
    date_format: "dd/MM/yyyy",
    time_format: "HH:mm",
    date_time_format: "dd/MM/yyyy HH:mm",
    first_day_of_week: 1, // Monday
    number_format: {
      decimal_separator: ".",
      thousands_separator: ",",
      decimal_places: 2,
      grouping: [3]
    },
    currency_format: {
      symbol: "£",
      code: "GBP",
      position: "before",
      spacing: false,
      decimal_places: 2
    },
    measurement_system: "metric"
  },
  fallback_locales: ["en-US", "en"],
  extensions: {
    seo: {
      hreflang: "en-GB",
      priority_region: "europe"
    },
    translation: {
      coverage: 1.0,
      variant: "british",
      last_updated: "2024-01-01"
    },
    regional: {
      spelling: "british",
      vocabulary: "british",
      postal_code_format: "[A-Z]{1,2}[0-9]{1,2} [0-9][A-Z]{2}"
    }
  }
};
