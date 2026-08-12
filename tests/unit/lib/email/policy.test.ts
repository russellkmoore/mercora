import { describe, expect, it } from "vitest";
import { emailDeliveryPolicy } from "@/lib/email/policy";

describe("email delivery policy", () => {
  it("suppresses only explicitly non-transactional review reminders", () => {
    expect(emailDeliveryPolicy.review_reminders).toBe("non_transactional");
    expect(Object.entries(emailDeliveryPolicy).filter(([, policy]) => policy === "transactional").map(([name]) => name)).toEqual([
      "review_status", "order_confirmation", "shipping_confirmation", "refund_confirmation", "merchant_notification",
    ]);
  });
});
