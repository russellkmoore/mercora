import type { CanonicalFacts } from "@/lib/ai/canonical-facts";
import { parse as parseDomain } from "tldts";

const MAX_GUARDED_REPLY_CHARS = 8_000;

const CONTACT_PATTERN = new RegExp(
  [
    "(?<email>(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})",
    "(?<url>(?:https?://|www\\.|//)[^\\s<>()\\[\\]\\x22'`]+)",
    "(?<bare>(?:(?:[A-Z0-9\\p{L}\\p{N}-]+\\.)+(?:XN--[A-Z0-9-]{2,59}|[A-Z\\p{L}]{2,63})|(?:\\d{1,3}\\.){3}\\d{1,3}|\\[[0-9A-F:]+\\])(?:/[^\\s<>()\\[\\]\\x22'`]*)?)",
  ].join("|"),
  "giu",
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

function isRecognizedBareDestination(token: string): boolean {
  const destination = parsedDestination(token);
  if (!destination) return false;
  const parsed = parseDomain(destination.hostname, {
    allowPrivateDomains: true,
    detectIp: true,
    validateHostname: true,
  });
  return parsed.isIp === true || (
    parsed.domain !== null
    && parsed.publicSuffix !== null
    && (parsed.isIcann === true || parsed.isPrivate === true)
  );
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

      if (isAllowedDestination(token, facts)) return rawMatch;
      if (groups?.bare !== undefined && !isRecognizedBareDestination(token)) return rawMatch;
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
