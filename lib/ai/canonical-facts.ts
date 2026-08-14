import { storeDefaults, type StoreConfig } from "@/lib/store-config";

const MAX_IDENTITY_LENGTH = 200;
const MAX_SUPPORT_HOURS_LENGTH = 300;
const MAX_BUSINESS_ADDRESS_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export interface CanonicalFacts {
  storeName: string;
  assistantName: string;
  supportEmail?: string;
  supportHours?: string;
  businessAddress?: string;
  siteUrl: string;
  orderHistoryUrl?: string;
  returnsUrl?: string;
  locale: string;
  currency: string;
  allowedHosts: readonly string[];
  allowedEmails: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedValue(value: unknown, ...path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function safeEmail(value: unknown): string | undefined {
  const candidate = boundedText(value, MAX_EMAIL_LENGTH)?.toLowerCase();
  if (!candidate || !EMAIL_PATTERN.test(candidate)) return undefined;
  const [local, domain] = candidate.split("@");
  if (
    !local
    || !domain
    || local.startsWith(".")
    || local.endsWith(".")
    || local.includes("..")
    || domain.includes("..")
    || domain.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
    || candidate === storeDefaults.contact.supportEmail.toLowerCase()
  ) {
    return undefined;
  }
  return candidate;
}

function safeLocale(value: unknown): string {
  const candidate = boundedText(value, 100);
  if (!candidate) return storeDefaults.commerce.locale;
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? storeDefaults.commerce.locale;
  } catch {
    return storeDefaults.commerce.locale;
  }
}

function safeCurrency(value: unknown): string {
  const candidate = boundedText(value, 3)?.toUpperCase();
  if (!candidate || !/^[A-Z]{3}$/.test(candidate)) return storeDefaults.commerce.currency;
  try {
    return Intl.supportedValuesOf("currency").includes(candidate)
      ? candidate
      : storeDefaults.commerce.currency;
  } catch {
    return storeDefaults.commerce.currency;
  }
}

function httpsUrl(value: unknown, base?: string): URL | undefined {
  const candidate = boundedText(value, 2_048);
  if (!candidate) return undefined;
  try {
    const url = base ? new URL(candidate, base) : new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url : undefined;
  } catch {
    return undefined;
  }
}

function httpsOrigin(value: unknown): string | undefined {
  return httpsUrl(value)?.origin;
}

function configuredHost(value: unknown, base?: string): string | undefined {
  return httpsUrl(value, base)?.hostname.toLowerCase() || undefined;
}

function publicAddress(value: unknown): string | undefined {
  const address = boundedText(value, MAX_BUSINESS_ADDRESS_LENGTH);
  if (!address) return undefined;
  if (
    address === storeDefaults.contact.postalAddress ||
    (/\breplace\b/i.test(address) && /\baddress\b/i.test(address)) ||
    /^<[^>]*address[^>]*>$/i.test(address)
  ) {
    return undefined;
  }
  return address;
}

/**
 * Derive the request's trusted store facts from the supplied configuration.
 * This function deliberately performs no environment reads and retains no
 * request-scoped values at module scope.
 */
export function canonicalFactsFromConfig(config: StoreConfig): CanonicalFacts {
  const rawConfig: unknown = config;
  const siteUrl = httpsOrigin(nestedValue(rawConfig, "urls", "site"))
    ?? storeDefaults.urls.site;
  const configuredReturns = nestedValue(rawConfig, "urls", "returns");
  const returnsUrl = httpsUrl(configuredReturns, siteUrl)?.href
    ?? new URL(storeDefaults.urls.returns, siteUrl).href;
  const supportEmail = safeEmail(nestedValue(rawConfig, "contact", "supportEmail"));
  const supportHours = boundedText(
    nestedValue(rawConfig, "contact", "supportHours"),
    MAX_SUPPORT_HOURS_LENGTH,
  );
  const businessAddress = publicAddress(nestedValue(rawConfig, "contact", "postalAddress"));

  const hosts = new Set<string>();
  for (const [value, base] of [
    [siteUrl, undefined],
    [nestedValue(rawConfig, "urls", "imageCdn"), undefined],
    [nestedValue(rawConfig, "urls", "privacy"), siteUrl],
    [nestedValue(rawConfig, "urls", "terms"), siteUrl],
    [configuredReturns, siteUrl],
  ] as const) {
    const host = configuredHost(value, base);
    if (host) hosts.add(host);
  }

  const emails = new Set<string>();
  if (supportEmail) emails.add(supportEmail);

  return {
    storeName: boundedText(nestedValue(rawConfig, "identity", "name"), MAX_IDENTITY_LENGTH)
      ?? storeDefaults.identity.name,
    assistantName: boundedText(
      nestedValue(rawConfig, "identity", "assistantName"),
      MAX_IDENTITY_LENGTH,
    ) ?? storeDefaults.identity.assistantName,
    ...(supportEmail ? { supportEmail } : {}),
    ...(supportHours ? { supportHours } : {}),
    ...(businessAddress ? { businessAddress } : {}),
    siteUrl,
    orderHistoryUrl: new URL("/account/orders", siteUrl).href,
    returnsUrl,
    locale: safeLocale(nestedValue(rawConfig, "commerce", "locale")),
    currency: safeCurrency(nestedValue(rawConfig, "commerce", "currency")),
    allowedHosts: [...hosts],
    allowedEmails: [...emails],
  };
}
