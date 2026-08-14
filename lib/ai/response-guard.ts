import type { CanonicalFacts } from "@/lib/ai/canonical-facts";

const MAX_GUARDED_REPLY_CHARS = 8_000;

const BARE_DOMAIN_TLDS = [
  "com", "net", "org", "edu", "gov", "int", "mil", "info", "biz", "name",
  "io", "co", "ai", "app", "dev", "us", "uk", "ca", "au", "de", "fr", "es",
  "it", "nl", "se", "no", "jp", "cn", "in", "br", "mx", "eu", "me", "tv",
  "cc", "ly", "sh", "gg", "to", "fm", "am", "at", "be", "ch", "cz", "dk",
  "fi", "gr", "hk", "ie", "il", "kr", "nz", "pl", "pt", "ro", "ru", "sg",
  "za", "shop", "store", "online", "site", "website", "web", "xyz", "top",
  "club", "life", "live", "world", "today", "email", "help", "support", "care",
  "health", "beauty", "spa", "tea", "organic", "green", "eco", "natural",
  "shopping", "market", "buy", "sale", "deals", "gift", "gifts", "brand",
  "company", "global", "group", "team", "agency", "services", "solutions",
  "digital", "media", "news", "blog", "page", "link", "click", "one", "now",
  "cloud", "tech", "technology", "software", "systems", "network", "computer",
  "tools", "space", "art", "design", "fashion", "style", "boutique", "photo",
  "photography", "museum", "travel", "pro", "mobi", "jobs", "aero", "asia",
  "cat", "coop", "tel", "finance", "financial", "money", "law", "legal",
  "lawyer", "doctor", "clinic", "dental", "insurance", "pharmacy", "social",
  "community", "foundation", "church", "events", "works", "expert", "tips",
  "center", "international", "capital", "ventures", "academy", "education",
  "school", "coffee", "restaurant", "food", "farm", "pet", "pets", "zone",
].join("|");

const CONTACT_PATTERN = new RegExp(
  [
    "(?<email>(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})",
    "(?<url>(?:https?://|www\\.|//)[^\\s<>()\\[\\]\\\"'`]+)",
    `(?<bare>(?:[A-Z0-9-]+\\.)+(?:${BARE_DOMAIN_TLDS})\\b(?:/[^\\s<>()\\[\\]"'\`]*)?)`,
  ].join("|"),
  "gi",
);

const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const EMBEDDED_DESTINATION = /(?:https?|mailto):\/\/|(?:https?|mailto):|\/\/|@/i;

export type GuardReplacementKind = "email" | "url";

export interface GuardResult {
  text: string;
  replacementCount: number;
  replacementKinds: readonly GuardReplacementKind[];
  failed: boolean;
}

function safeFallback(facts: CanonicalFacts): string {
  return facts.supportEmail
    ? `I couldn't safely format that response. Please contact ${facts.supportEmail}.`
    : "I couldn't safely format that response. Please try again.";
}

function isLikelyBareDomain(token: string): boolean {
  const host = token.split(/[/?#]/)[0];
  const tld = host.slice(host.lastIndexOf(".") + 1);
  return !/^[A-Z][a-z]+$/.test(tld);
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function allowedEmails(facts: CanonicalFacts): Set<string> {
  return new Set(facts.allowedEmails.map(normalizedEmail));
}

function allowedHosts(facts: CanonicalFacts): Set<string> {
  return new Set(facts.allowedHosts.map((host) => host.trim().toLowerCase()));
}

function parsedDestination(token: string): URL | null {
  try {
    const candidate = token.startsWith("//")
      ? `https:${token}`
      : token.startsWith("www.")
        ? `https://${token}`
        : /^[a-z][a-z0-9+.-]*:/i.test(token)
          ? token
          : `https://${token}`;
    return new URL(candidate);
  } catch {
    return null;
  }
}

function isAllowedDestination(token: string, facts: CanonicalFacts): boolean {
  const destination = parsedDestination(token);
  if (!destination) return false;
  if (
    destination.protocol !== "https:" ||
    destination.username ||
    destination.password ||
    destination.port ||
    destination.hostname.endsWith(".") ||
    !allowedHosts(facts).has(destination.hostname.toLowerCase())
  ) {
    return false;
  }

  const withoutScheme = token.replace(/^(?:https?:)?\/\//i, "");
  const authorityLength = withoutScheme.split(/[/?#]/, 1)[0].length;
  let remainder = withoutScheme.slice(authorityLength);
  for (let pass = 0; pass < 3; pass += 1) {
    if (EMBEDDED_DESTINATION.test(remainder)) return false;
    try {
      const decoded = decodeURIComponent(remainder);
      if (decoded === remainder) break;
      remainder = decoded;
    } catch {
      return false;
    }
  }
  return !EMBEDDED_DESTINATION.test(remainder);
}

function replacementSite(facts: CanonicalFacts): string {
  return facts.siteUrl ?? "the store website";
}

export function guardAssistantReply(reply: unknown, facts: CanonicalFacts): GuardResult {
  try {
    if (typeof reply !== "string") {
      return {
        text: safeFallback(facts),
        replacementCount: 0,
        replacementKinds: [],
        failed: true,
      };
    }
    if (reply.length > MAX_GUARDED_REPLY_CHARS) {
      return {
        text: safeFallback(facts),
        replacementCount: 0,
        replacementKinds: [],
        failed: true,
      };
    }
    if (!reply) return { text: "", replacementCount: 0, replacementKinds: [], failed: false };

    const emailAllowlist = allowedEmails(facts);
    const replacementKinds: GuardReplacementKind[] = [];
    let replacementCount = 0;

    const text = reply.replace(CONTACT_PATTERN, (rawMatch: string, ...args: unknown[]) => {
      const groups = args[args.length - 1] as
        | { email?: string; url?: string; bare?: string }
        | undefined;
      const trailing = rawMatch.match(TRAILING_PUNCTUATION)?.[0] ?? "";
      const token = trailing ? rawMatch.slice(0, -trailing.length) : rawMatch;
      if (!token) return rawMatch;

      if (groups?.email !== undefined) {
        const mailto = /^mailto:/i.test(token);
        const address = mailto ? token.slice("mailto:".length) : token;
        if (emailAllowlist.has(normalizedEmail(address))) return rawMatch;
        replacementCount += 1;
        replacementKinds.push("email");
        const replacement = facts.supportEmail ?? "customer support";
        return `${mailto && facts.supportEmail ? "mailto:" : ""}${replacement}${trailing}`;
      }

      if (groups?.bare !== undefined && !isLikelyBareDomain(token)) return rawMatch;
      if (isAllowedDestination(token, facts)) return rawMatch;
      replacementCount += 1;
      replacementKinds.push("url");
      return `${replacementSite(facts)}${trailing}`;
    });

    return {
      text,
      replacementCount,
      replacementKinds: [...new Set(replacementKinds)],
      failed: false,
    };
  } catch {
    return {
      text: safeFallback(facts),
      replacementCount: 0,
      replacementKinds: [],
      failed: true,
    };
  }
}
