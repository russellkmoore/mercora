import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedPages: vi.fn(),
  getNavigationPages: vi.fn(),
  searchPages: vi.fn(),
  getPageBySlug: vi.fn(),
}));

vi.mock("@/lib/models/pages", () => mocks);

import { NextRequest } from "next/server";
import { GET as listPages } from "@/app/api/pages/route";
import { GET as getPage } from "@/app/api/pages/[slug]/route";

const fullPage = {
  id: 7,
  title: "Public",
  slug: "public",
  content: "<p>Body</p>",
  excerpt: null,
  meta_title: null,
  meta_description: null,
  meta_keywords: null,
  template: "default",
  published_at: 10,
  updated_at: 11,
  nav_title: null,
  custom_css: null,
  custom_js: "secret()",
  required_roles: '["staff"]',
  created_by: "user_1",
  updated_by: "user_2",
  is_protected: false,
};

describe("public CMS APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedPages.mockResolvedValue([fullPage]);
    mocks.getPageBySlug.mockResolvedValue(fullPage);
  });

  it("projects rows without script, roles, or actor identifiers", async () => {
    const response = await getPage(
      new NextRequest("https://store.example.test/api/pages/public"),
      { params: Promise.resolve({ slug: "public" }) },
    );
    const body = await response.json() as { data: Record<string, unknown> };
    expect(response.status).toBe(200);
    expect(body.data).not.toHaveProperty("custom_js");
    expect(body.data).not.toHaveProperty("required_roles");
    expect(body.data).not.toHaveProperty("created_by");
    expect(mocks.getPageBySlug).toHaveBeenCalledWith("public", false);
  });

  it("applies the same safe projection to list results", async () => {
    const response = await listPages(new NextRequest("https://store.example.test/api/pages"));
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    expect(body.data[0]).not.toHaveProperty("custom_js");
    expect(body.data[0]).not.toHaveProperty("content");
    expect(body.data[0]).not.toHaveProperty("custom_css");
    expect(mocks.getPublishedPages).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  it("bounds search input before model access", async () => {
    const response = await listPages(new NextRequest(
      `https://store.example.test/api/pages?search=${"a".repeat(101)}`,
    ));
    expect(response.status).toBe(400);
    expect(mocks.searchPages).not.toHaveBeenCalled();
  });

  it("passes bounded search pagination through to the model", async () => {
    mocks.searchPages.mockResolvedValue([]);
    await listPages(new NextRequest("https://store.example.test/api/pages?search=guide&limit=5&offset=25"));
    expect(mocks.searchPages).toHaveBeenCalledWith("guide", {
      includeUnpublished: false,
      limit: 5,
      offset: 25,
    });
  });
});
