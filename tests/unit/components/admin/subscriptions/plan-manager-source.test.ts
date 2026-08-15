import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("admin subscription plan management UI", () => {
  it("explains manual Stripe Price binding and deactivates with confirmation", () => {
    const source = read("components/admin/subscriptions/SubscriptionPlanManager.tsx");
    expect(source).toContain("This form does not create Stripe Prices");
    expect(source).toContain("window.confirm");
    expect(source).toContain("{ active: false }");
    expect(source).not.toMatch(/method:\s*["']DELETE["']/);
    expect(source).not.toMatch(/console\.(?:log|error)/);
  });

  it("adds subscription plan navigation and breadcrumbs", () => {
    const sidebar = read("components/admin/AdminSidebar.tsx");
    const layout = read("components/admin/AdminLayoutProvider.tsx");
    expect(sidebar).toContain('href: "/admin/subscription-plans"');
    expect(sidebar).toContain('label: "Subscriptions"');
    expect(layout).toContain("case 'subscription-plans':");
    expect(layout).toContain("Subscription Plan Management");
  });
});
