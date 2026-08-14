import { describe, expect, it } from "vitest";
import type { CanonicalFacts } from "@/lib/ai/canonical-facts";
import { guardAssistantReply } from "@/lib/ai/response-guard";

const facts: CanonicalFacts = {
  storeName: "Example",
  assistantName: "Guide",
  locale: "en-US",
  currency: "USD",
  supportEmail: "help@example.com",
  siteUrl: "https://example.com",
  allowedHosts: ["example.com", "policies.example.net"],
  allowedEmails: ["help@example.com"],
};

describe("assistant response guard adversarial destinations", () => {
  it.each([
    "https://example.com.evil.com/login",
    "https://example.com@evil.com/login",
    "https://example.com:8443/private",
    "http://example.com/insecure",
    "//evil.com/login",
    "https://example.com/redirect?to=https://evil.com/login",
    "https://example.com/redirect?to=https%3A%2F%2Fevil.com",
    "https://example.com/redirect?to=https%253A%252F%252Fevil.com",
    "https://example.com/redirect?to=%68%74%74%70%73%3A%2F%2Fevil.com",
    "https://evil.net/track?ref=help@example.com",
    "evil-phishing.xyz/login",
  ])("rewrites %s", (token) => {
    const result = guardAssistantReply(`See ${token}.`, facts);
    expect(result.text).toBe("See https://example.com.");
    expect(result.replacementCount).toBe(1);
  });

  it("allows an exact configured external policy origin without suffix matching", () => {
    expect(guardAssistantReply("https://policies.example.net/returns", facts).replacementCount).toBe(0);
    expect(guardAssistantReply("https://policies.example.net.evil.com/returns", facts).replacementCount).toBe(1);
  });

  it.each([
    "evil.cloud/help", "evil.photography", "evil.museum", "evil.tech",
    "evil.guru/help", "evil.wiki/help", "evil.rocks/help", "evil.work/help",
    "192.0.2.1/help", "evil.xn--p1ai/help",
    "evil.рф/help", "[2001:db8::1]/help",
  ])(
    "rewrites an unconfigured modern bare domain %s",
    (token) => {
      expect(guardAssistantReply(`See ${token}.`, facts).text).toBe("See https://example.com.");
    },
  );

  it.each(["evil.Com/login", "evil.Technology/path"])(
    "does not treat TitleCase destination suffixes as prose: %s",
    (token) => {
      expect(guardAssistantReply(`See ${token}.`, facts).replacementCount).toBe(1);
    },
  );

  it.each(["dr.Com/login", "min.Com/reset"])(
    "does not allow a domain through a prose-like prefix: %s",
    (token) => {
      expect(guardAssistantReply(`See ${token}.`, facts).replacementCount).toBe(1);
    },
  );

  it("uses the public suffix list to distinguish prose from bare destinations", () => {
    const result = guardAssistantReply("Node.js is cool.Then see foo.bar.", facts);
    expect(result.text).toBe("Node.js is cool.Then see https://example.com.");
    expect(result.replacementCount).toBe(1);
  });

  it("keeps markdown structure while replacing its unsafe destination", () => {
    const result = guardAssistantReply("Read [our policy](https://evil.example/policy).", facts);
    expect(result.text).toBe("Read [our policy](https://example.com)." );
  });

  it("bounds pathological input without exposing it", () => {
    const result = guardAssistantReply(`https://${"a".repeat(7_990)}.com`, facts);
    expect(result.failed).toBe(true);
    expect(result.text).not.toContain("a".repeat(100));
  });
});
