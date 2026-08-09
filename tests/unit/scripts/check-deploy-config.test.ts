import { describe, expect, it } from "vitest";
import { validateOrderStatusConfig } from "@/scripts/check-deploy-config.mjs";

const SECRET = "deployment-test-order-status-secret-0123456789";

describe("validateOrderStatusConfig", () => {
  it("requires a non-placeholder secret when guest links are enabled", () => {
    expect(() => validateOrderStatusConfig(
      { ORDER_STATUS_GUEST_LINKS_ENABLED: "true" },
    )).toThrow(/ORDER_STATUS_SECRET/);
    expect(() => validateOrderStatusConfig({
      ORDER_STATUS_GUEST_LINKS_ENABLED: "true",
      ORDER_STATUS_SECRET: "replace_with_at_least_32_random_characters",
    })).toThrow(/non-placeholder/);
    expect(() => validateOrderStatusConfig({
      ORDER_STATUS_GUEST_LINKS_ENABLED: "true",
      ORDER_STATUS_SECRET: SECRET,
    })).not.toThrow();
  });

  it("validates configured secrets while allowing explicitly disabled guest links", () => {
    expect(() => validateOrderStatusConfig({
      ORDER_STATUS_SECRET: "short",
    })).toThrow(/at least 32/);
    expect(() => validateOrderStatusConfig({
      ORDER_STATUS_GUEST_LINKS_ENABLED: "false",
    })).not.toThrow();
  });
});
