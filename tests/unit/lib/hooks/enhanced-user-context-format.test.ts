import { describe, expect, it } from "vitest";
import {
  formatUserContextForAI,
  type EnhancedUserContext,
} from "@/lib/hooks/useEnhancedUserContext";

describe("formatUserContextForAI", () => {
  it("omits currency-ambiguous totals and internal product identifiers", () => {
    const context: EnhancedUserContext = {
      firstName: "Avery",
      profileComplete: true,
      emailVerified: true,
      phoneVerified: false,
      accountAge: 30,
      customerLifecycle: "active",
      engagementLevel: "high",
      locationPattern: "unknown",
      orders: [{} as EnhancedUserContext["orders"][number]],
      totalOrderValue: 1_234.56,
      favoriteCategories: [],
      recentPurchases: ["internal-product-id"],
      averageOrderValue: 1_234.56,
      isFirstTimeUser: false,
      isVipCustomer: true,
      preferredPriceRange: { min: 1_000, max: 2_000 },
      isLoading: false,
      error: null,
    };

    const result = formatUserContextForAI(context);
    expect(result).toContain("1 previous orders");
    expect(result).not.toMatch(/Total spent|Average order|VIP Customer|\$/);
    expect(result).not.toContain("internal-product-id");
  });
});
