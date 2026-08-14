import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getCustomJsEnabled: vi.fn(),
  getPageBySlug: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/cms/custom-js-guard", () => ({ getCustomJsEnabled: mocks.getCustomJsEnabled }));
vi.mock("@/lib/models/pages", () => ({ getPageBySlug: mocks.getPageBySlug }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/pages/[slug]/script/route";

function run(slug = "about") {
  return GET(new NextRequest(`https://store.example.test/api/pages/${slug}/script`), {
    params: Promise.resolve({ slug }),
  });
}

describe("CMS page script route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCustomJsEnabled.mockResolvedValue(true);
    mocks.getPageBySlug.mockResolvedValue({
      slug: "about",
      custom_js: "window.pageEnhancement = true;",
      is_protected: false,
    });
    mocks.auth.mockResolvedValue({ userId: null });
  });

  it("serves enabled code from a CSP-compatible same-origin resource", async () => {
    const response = await run();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(await response.text()).toContain("window.pageEnhancement = true");
  });

  it("does not read or expose stored code while the kill switch is off", async () => {
    mocks.getCustomJsEnabled.mockResolvedValue(false);
    const response = await run();
    expect(response.status).toBe(404);
    expect(mocks.getPageBySlug).not.toHaveBeenCalled();
  });

  it("does not expose a protected page script to a signed-out request", async () => {
    mocks.getPageBySlug.mockResolvedValue({ custom_js: "secret()", is_protected: true });
    expect((await run()).status).toBe(404);
  });

  it("serves a protected page script to an authenticated visitor", async () => {
    mocks.getPageBySlug.mockResolvedValue({ custom_js: "member()", is_protected: true });
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    expect((await run()).status).toBe(200);
  });
});
