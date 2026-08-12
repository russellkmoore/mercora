import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PDP recommendation boundary", () => {
  it("resolves recommendations on the server and projects them before client rendering", () => {
    const page = readFileSync(resolve("app/product/[slug]/page.tsx"), "utf8");
    const component = readFileSync(resolve("components/ProductRecommendations.tsx"), "utf8");
    expect(page).toContain("getRecommendationsForProduct(storedProduct");
    expect(page).toContain("products.map(toPublicProduct)");
    expect(component).not.toContain("/api/agent-chat");
    expect(component).not.toContain('"use client"');
  });

  it("routes the daily cron through the app worker", () => {
    const worker = readFileSync(resolve("worker.ts"), "utf8");
    const scheduled = readFileSync(resolve("lib/observability/scheduled.ts"), "utf8");
    const config = readFileSync(resolve("wrangler.jsonc"), "utf8");
    expect(worker).toContain("handleScheduled(controller, env, ctx)");
    expect(scheduled).toContain("controller.cron === '15 8 * * *'");
    expect(scheduled).toContain("runRecommendationCron(env)");
    expect(config).toContain('"15 8 * * *"');
  });

  it("keeps recommendation admin mutations authenticated, bounded, and generic on failure", () => {
    const settings = readFileSync(
      resolve("app/api/admin/recommendations/settings/route.ts"),
      "utf8",
    );
    const rebuild = readFileSync(
      resolve("app/api/admin/recommendations/rebuild/route.ts"),
      "utf8",
    );
    expect(settings).toContain("checkAdminPermissions(request)");
    expect(settings).toContain("MAX_BODY_BYTES");
    expect(settings).toContain("request.text()");
    expect(rebuild).toContain("checkAdminPermissions(request)");
    expect(rebuild).not.toContain("detail:");
  });
});
