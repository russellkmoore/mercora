/**
 * Store configuration is deliberately resolved at the edge of the runtime.
 *
 * Do not read `process.env` into exported constants here.  A module-scope
 * value is captured while Next builds the bundle and can accidentally leak a
 * development URL or a preview configuration into a production deployment.
 * Call `getStoreConfig()` from a request/render instead.
 */

import { CURRENCY_PRECISION } from "./money/currencies";

export type Environment = Record<string, string | undefined>;

export type StoreCarrierDefinition = {
  /** Stable lowercase code persisted with an order. */
  code: string;
  /** Customer- and operator-facing name. */
  label: string;
  /** HTTPS URL containing one `{trackingNumber}` placeholder. */
  trackingUrlTemplate?: string;
  /** Historical free-text values accepted while reading existing orders. */
  legacyAliases: readonly string[];
};

export type StoreConfig = {
  identity: {
    name: string;
    tagline: string;
    description: string;
    assistantName: string;
  };
  contact: {
    supportEmail: string;
    senderEmail: string;
    replyToEmail?: string;
    merchantNotificationEmail?: string;
    postalAddress: string;
    supportHours: string;
  };
  urls: {
    site: string;
    imageCdn?: string;
    clerkHost?: string;
    privacy: string;
    terms: string;
    returns: string;
  };
  persistence: {
    namespace: string;
    cartKey: string;
    chatKey: string;
  };
  theme: {
    mode: "dark" | "light";
    primary: string;
    surface: string;
    surfaceElevated: string;
    foreground: string;
    mutedForeground: string;
    logoPath: string;
  };
  social: Record<"instagram" | "facebook" | "x" | "youtube" | "linkedin", string>;
  mcp: {
    capabilities: string;
    description: string;
  };
  commerce: {
    locale: string;
    currency: string;
    freeShippingThresholdCents?: number;
    carriers: readonly StoreCarrierDefinition[];
    features: {
      recommendations: boolean;
      giftCards: boolean;
      subscriptions: boolean;
    };
  };
  deployment: {
    indexable: boolean;
    imageTransformsEnabled: boolean;
  };
};

/** Neutral demo defaults. Store operators override only the public values they need. */
export const storeDefaults: StoreConfig = {
  identity: {
    name: "Mercora",
    tagline: "Commerce on the edge",
    description: "An extensible commerce storefront powered by open knowledge.",
    assistantName: "Volt",
  },
  contact: {
    supportEmail: "support@mercora.example.com",
    senderEmail: "Mercora <support@mercora.example.com>",
    postalAddress: "Replace with your business postal address before launch.",
    supportHours: "Monday–Friday, 9:00–17:00 local time",
  },
  urls: {
    site: "https://mercora.example.com",
    privacy: "/privacy",
    terms: "/terms",
    returns: "/returns",
  },
  persistence: {
    namespace: "mercora",
    cartKey: "mercora.cart",
    chatKey: "mercora.chat",
  },
  theme: {
    mode: "dark",
    primary: "#f97316",
    surface: "#000000",
    surfaceElevated: "#171717",
    foreground: "#ffffff",
    mutedForeground: "#a3a3a3",
    logoPath: "/volt.png",
  },
  social: { instagram: "", facebook: "", x: "", youtube: "", linkedin: "" },
  mcp: {
    capabilities: "commerce,multi-agent,e-commerce",
    description: "Mercora MCP Server for commerce workflows.",
  },
  commerce: {
    locale: "en-US",
    currency: "USD",
    carriers: [
      {
        code: "ups",
        label: "UPS",
        trackingUrlTemplate:
          "https://www.ups.com/track?loc=en_US&tracknum={trackingNumber}",
        legacyAliases: ["united parcel service", "unitedparcel"],
      },
      {
        code: "fedex",
        label: "FedEx",
        trackingUrlTemplate:
          "https://www.fedex.com/fedextrack/?trknbr={trackingNumber}",
        legacyAliases: ["federal express", "federalexpress"],
      },
      {
        code: "usps",
        label: "USPS",
        trackingUrlTemplate:
          "https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}",
        legacyAliases: ["united states postal service", "us postal service"],
      },
      { code: "other", label: "Other", legacyAliases: [] },
    ],
    features: { recommendations: true, giftCards: false, subscriptions: false },
  },
  deployment: {
    // A host must opt in explicitly. Preview deployments must never be indexed
    // merely because NODE_ENV is "production".
    indexable: false,
    imageTransformsEnabled: true,
  },
};

function text(env: Environment, key: string, fallback: string) {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

function bool(env: Environment, key: string, fallback: boolean) {
  const value = env[key]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function optionalHttpsUrl(env: Environment, key: string) {
  const value = env[key]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function optionalEmail(env: Environment, key: string): string | undefined {
  const value = env[key]?.trim();
  return value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value
    : undefined;
}

const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function safeSender(value: string | undefined, fallbackName: string, fallbackEmail: string): string {
  const candidate = value?.trim();
  if (candidate && candidate.length <= 320) {
    const named = candidate.match(/^([^<>]{1,100})\s*<([^<>]+)>$/);
    if (named && EMAIL_ADDRESS_PATTERN.test(named[2].trim())) {
      return `${named[1].trim()} <${named[2].trim()}>`;
    }
    if (EMAIL_ADDRESS_PATTERN.test(candidate)) return candidate;
  }
  const email = EMAIL_ADDRESS_PATTERN.test(fallbackEmail)
    ? fallbackEmail
    : storeDefaults.contact.supportEmail;
  return `${fallbackName} <${email}>`;
}

function policyUrl(env: Environment, key: string, fallback: string): string {
  const value = env[key]?.trim();
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function siteUrl(env: Environment) {
  return optionalHttpsUrl(env, "NEXT_PUBLIC_SITE_URL") ?? storeDefaults.urls.site;
}

function locale(env: Environment): string {
  const candidate = env.STORE_LOCALE?.trim();
  if (!candidate || candidate.length > 100) return storeDefaults.commerce.locale;

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? storeDefaults.commerce.locale;
  } catch {
    return storeDefaults.commerce.locale;
  }
}

function currency(env: Environment): string {
  const candidate = env.STORE_CURRENCY?.trim().toUpperCase();
  return candidate && Object.hasOwn(CURRENCY_PRECISION, candidate)
    ? candidate
    : storeDefaults.commerce.currency;
}

const CARRIER_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_CARRIER_LABEL_LENGTH = 80;
const MAX_CARRIER_ALIAS_LENGTH = 80;
const MAX_CARRIER_ALIASES = 20;
const TRACKING_PLACEHOLDER = "{trackingNumber}";

function compactCarrierToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._-]/g, "");
}

function safeTrackingTemplate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  if (value.split(TRACKING_PLACEHOLDER).length !== 2) return undefined;

  try {
    const parsed = new URL(value.replace(TRACKING_PLACEHOLDER, "TRACKING_NUMBER"));
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.hostname.includes("tracking_number")
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Parse an operator-provided registry atomically. A malformed entry makes the
 * whole value fall back to the known-safe defaults instead of creating a
 * partially configured checkout at runtime.
 */
function parseCarrierDefinitions(value: string | undefined): readonly StoreCarrierDefinition[] {
  if (!value?.trim()) return storeDefaults.commerce.carriers;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return storeDefaults.commerce.carriers;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) {
    return storeDefaults.commerce.carriers;
  }

  const definitions: StoreCarrierDefinition[] = [];
  const definitionCodes = new Set<string>();
  const claimedTokens = new Map<string, string>();
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return storeDefaults.commerce.carriers;
    }
    const raw = candidate as Record<string, unknown>;
    if (typeof raw.code !== "string" || typeof raw.label !== "string") {
      return storeDefaults.commerce.carriers;
    }

    const code = raw.code.trim().toLowerCase();
    const label = raw.label.trim();
    if (
      !CARRIER_CODE_PATTERN.test(code) ||
      !label ||
      label.length > MAX_CARRIER_LABEL_LENGTH ||
      definitionCodes.has(code)
    ) {
      return storeDefaults.commerce.carriers;
    }
    definitionCodes.add(code);

    const template = raw.trackingUrlTemplate;
    const trackingUrlTemplate = template === undefined
      ? undefined
      : safeTrackingTemplate(template);
    if (template !== undefined && trackingUrlTemplate === undefined) {
      return storeDefaults.commerce.carriers;
    }

    if (!Array.isArray(raw.legacyAliases) || raw.legacyAliases.length > MAX_CARRIER_ALIASES) {
      return storeDefaults.commerce.carriers;
    }
    const legacyAliases: string[] = [];
    for (const alias of raw.legacyAliases) {
      if (typeof alias !== "string") return storeDefaults.commerce.carriers;
      const trimmed = alias.trim();
      if (!trimmed || trimmed.length > MAX_CARRIER_ALIAS_LENGTH) {
        return storeDefaults.commerce.carriers;
      }
      legacyAliases.push(trimmed);
    }

    for (const valueToClaim of [code, ...legacyAliases]) {
      const compact = compactCarrierToken(valueToClaim);
      if (!compact) return storeDefaults.commerce.carriers;
      const existingOwner = claimedTokens.get(compact);
      if (existingOwner && existingOwner !== code) return storeDefaults.commerce.carriers;
      if (existingOwner === code) continue;
      for (const [claimed, owner] of claimedTokens) {
        if (
          owner !== code &&
          (claimed.startsWith(compact) || compact.startsWith(claimed))
        ) {
          return storeDefaults.commerce.carriers;
        }
      }
      claimedTokens.set(compact, code);
    }
    definitions.push({ code, label, ...(trackingUrlTemplate ? { trackingUrlTemplate } : {}), legacyAliases });
  }

  return definitions;
}

/**
 * Resolve a request/build configuration without throwing for absent optional
 * configuration. Validation of launch-only placeholders belongs in the
 * deployment script, not in import-time application code.
 */
export function resolveStoreConfig(env: Environment = {}): StoreConfig {
  const name = text(env, "NEXT_PUBLIC_STORE_NAME", storeDefaults.identity.name);
  const supportEmail = text(env, "STORE_SUPPORT_EMAIL", storeDefaults.contact.supportEmail);

  return {
    ...storeDefaults,
    identity: {
      ...storeDefaults.identity,
      name,
      tagline: text(env, "NEXT_PUBLIC_STORE_TAGLINE", storeDefaults.identity.tagline),
      description: text(env, "NEXT_PUBLIC_STORE_DESCRIPTION", storeDefaults.identity.description),
      assistantName: text(env, "NEXT_PUBLIC_ASSISTANT_NAME", storeDefaults.identity.assistantName),
    },
    contact: {
      ...storeDefaults.contact,
      supportEmail,
      senderEmail: safeSender(env.STORE_SENDER_EMAIL, name, supportEmail),
      replyToEmail: optionalEmail(env, "STORE_REPLY_TO_EMAIL") ?? optionalEmail(env, "STORE_SUPPORT_EMAIL"),
      merchantNotificationEmail: optionalEmail(env, "STORE_MERCHANT_NOTIFICATION_EMAIL"),
      postalAddress: text(env, "STORE_POSTAL_ADDRESS", storeDefaults.contact.postalAddress),
      supportHours: text(env, "STORE_SUPPORT_HOURS", storeDefaults.contact.supportHours),
    },
    urls: {
      ...storeDefaults.urls,
      site: siteUrl(env),
      imageCdn: optionalHttpsUrl(env, "NEXT_PUBLIC_IMAGE_CDN"),
      clerkHost: optionalHttpsUrl(env, "NEXT_PUBLIC_CLERK_HOST"),
      privacy: policyUrl(env, "NEXT_PUBLIC_PRIVACY_URL", storeDefaults.urls.privacy),
      terms: policyUrl(env, "NEXT_PUBLIC_TERMS_URL", storeDefaults.urls.terms),
      returns: policyUrl(env, "NEXT_PUBLIC_RETURNS_URL", storeDefaults.urls.returns),
    },
    persistence: {
      ...storeDefaults.persistence,
      namespace: text(env, "NEXT_PUBLIC_STORAGE_NAMESPACE", storeDefaults.persistence.namespace),
      cartKey: text(env, "NEXT_PUBLIC_CART_STORAGE_KEY", storeDefaults.persistence.cartKey),
      chatKey: text(env, "NEXT_PUBLIC_CHAT_STORAGE_KEY", storeDefaults.persistence.chatKey),
    },
    theme: {
      ...storeDefaults.theme,
      primary: text(env, "NEXT_PUBLIC_THEME_PRIMARY", storeDefaults.theme.primary),
      logoPath: text(env, "NEXT_PUBLIC_STORE_LOGO_PATH", storeDefaults.theme.logoPath),
    },
    mcp: {
      ...storeDefaults.mcp,
      capabilities: text(env, "MCP_CAPABILITIES", storeDefaults.mcp.capabilities),
      description: text(env, "MCP_DESCRIPTION", `${name} MCP Server for commerce workflows.`),
    },
    commerce: {
      ...storeDefaults.commerce,
      locale: locale(env),
      currency: currency(env),
      freeShippingThresholdCents: parseOptionalCents(env["STORE_FREE_SHIPPING_THRESHOLD_CENTS"]),
      carriers: parseCarrierDefinitions(env["STORE_CARRIERS_JSON"]),
    },
    deployment: {
      indexable: bool(env, "NEXT_PUBLIC_ROBOTS_INDEX", storeDefaults.deployment.indexable),
      imageTransformsEnabled: bool(
        env,
        "NEXT_PUBLIC_IMAGE_TRANSFORMS",
        storeDefaults.deployment.imageTransformsEnabled,
      ),
    },
  };
}

function parseOptionalCents(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

/** Runtime entry point; safe when Cloudflare lazily populates process.env. */
export function getStoreConfig() {
  return resolveStoreConfig(process.env);
}
