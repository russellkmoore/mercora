import { describe, expect, it } from "vitest";
import {
  parseAdminPlanQuery,
  parsePublicPlanQuery,
  parseUpdatePlanBody,
  readPlanJson,
} from "@/lib/subscriptions/plan-api";
import { SubscriptionPlanValidationError } from "@/lib/subscriptions/plan-service";

describe("subscription plan HTTP validation", () => {
  it("parses strict bounded public filters", () => {
    expect(parsePublicPlanQuery(new URLSearchParams(
      "productId=prod_tea&variantId=var_black&limit=100&offset=1000000",
    ))).toEqual({
      productId: "prod_tea", variantId: "var_black", limit: 100, offset: 1_000_000,
    });
  });

  it.each([
    "limit=0", "limit=101", "limit=1.5", "offset=-1", "offset=1000001",
    "productId=bad%20id", "variantId=", "unknown=true", "limit=1&limit=2",
  ])("rejects malformed, repeated, and unknown public queries: %s", (query) => {
    expect(() => parsePublicPlanQuery(new URLSearchParams(query)))
      .toThrow(SubscriptionPlanValidationError);
  });

  it("accepts only exact admin active filters", () => {
    expect(parseAdminPlanQuery(new URLSearchParams("active=false")))
      .toEqual({ limit: 20, offset: 0, active: false });
    expect(() => parseAdminPlanQuery(new URLSearchParams("active=1")))
      .toThrow(SubscriptionPlanValidationError);
  });

  it("bounds JSON bodies by declared and actual UTF-8 bytes", async () => {
    await expect(readPlanJson(new Request("https://store.example", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "8193" },
      body: "{}",
    }))).rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await expect(readPlanJson(new Request("https://store.example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "é".repeat(4_100) }),
    }))).rejects.toBeInstanceOf(SubscriptionPlanValidationError);
  });

  it("requires exact update envelope keys", () => {
    expect(parseUpdatePlanBody({
      expectedUpdatedAt: "2026-08-15T00:00:00.000Z",
      patch: { active: false },
    })).toEqual({
      expectedUpdatedAt: "2026-08-15T00:00:00.000Z",
      patch: { active: false },
    });
    expect(() => parseUpdatePlanBody({
      expectedUpdatedAt: "2026-08-15T00:00:00.000Z",
      patch: { active: false },
      actorId: "should-not-be-accepted",
    })).toThrow(SubscriptionPlanValidationError);
  });
});
