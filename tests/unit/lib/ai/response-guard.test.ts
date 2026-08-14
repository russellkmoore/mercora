import { describe, expect, it } from "vitest";
import type { CanonicalFacts } from "@/lib/ai/canonical-facts";
import { guardAssistantReply } from "@/lib/ai/response-guard";

const facts: CanonicalFacts = {
  storeName: "Example Store",
  assistantName: "Helper",
  locale: "en-US",
  currency: "USD",
  supportEmail: "help@shop.example.test",
  supportHours: "Weekdays",
  businessAddress: "1 Main Street",
  siteUrl: "https://shop.example.test",
  orderHistoryUrl: "https://shop.example.test/account/orders",
  returnsUrl: "https://shop.example.test/returns",
  allowedHosts: ["shop.example.test", "images.example.test", "policies.example.test"],
  allowedEmails: ["help@shop.example.test"],
};

describe("assistant response guard", () => {
  it("preserves exact configured destinations and canonical email casing", () => {
    const result = guardAssistantReply(
      "Email HELP@SHOP.EXAMPLE.TEST or see https://shop.example.test/returns and images.example.test/photo.",
      facts,
    );
    expect(result).toMatchObject({ replacementCount: 0, failed: false });
    expect(result.text).toContain("HELP@SHOP.EXAMPLE.TEST");
    expect(result.text).toContain("https://shop.example.test/returns");
  });

  it("rewrites unknown mailboxes and destinations without returning their values as metadata", () => {
    const result = guardAssistantReply(
      "Try mailto:support@evil.xyz, sales@shop.example.test, or https://evil.example/returns.",
      facts,
    );
    expect(result.text).toBe(
      "Try mailto:help@shop.example.test, help@shop.example.test, or https://shop.example.test.",
    );
    expect(result.replacementCount).toBe(3);
    expect(result.replacementKinds).toEqual(["email", "url"]);
    expect(JSON.stringify(result)).not.toContain("evil.xyz");
  });

  it("preserves ordinary dotted prose and versions", () => {
    const text = "Steep for 5 min.Then wait. Version 2.0.1 is current.";
    expect(guardAssistantReply(text, facts).text).toBe(text);
  });

  it("fails safely for non-string and oversized model output", () => {
    expect(guardAssistantReply({ response: "https://evil.example" }, facts)).toMatchObject({
      failed: true,
      text: "I couldn't safely format that response. Please contact help@shop.example.test.",
    });
    expect(guardAssistantReply("x".repeat(8_001), facts).failed).toBe(true);
  });
});
