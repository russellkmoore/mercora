import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  adminCreateBlogCategory: vi.fn(),
  getBlogCategories: vi.fn(),
}));
vi.mock("@/lib/auth/admin-middleware", () => ({ checkAdminPermissions: mocks.checkAdminPermissions }));
vi.mock("@/lib/models/blog", () => ({
  adminCreateBlogCategory: mocks.adminCreateBlogCategory,
  getBlogCategories: mocks.getBlogCategories,
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/blog/categories/route";

function request(method: "GET" | "POST", body?: unknown) {
  return new NextRequest("https://store.example.test/api/admin/blog/categories", {
    method,
    headers: { "content-type": "application/json", origin: "https://store.example.test" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("admin Blog categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.getBlogCategories.mockResolvedValue([]);
  });

  it("authenticates before listing categories", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Denied" });
    expect((await GET(request("GET"))).status).toBe(401);
    expect(mocks.getBlogCategories).not.toHaveBeenCalled();
  });

  it("creates a validated category through the model", async () => {
    mocks.adminCreateBlogCategory.mockResolvedValue({ id: 3, name: "Guides", slug: "guides" });
    const response = await POST(request("POST", { name: "Guides" }));
    expect(response.status).toBe(201);
    expect(mocks.adminCreateBlogCategory).toHaveBeenCalledWith({ name: "Guides" });
  });

  it("rejects malformed bodies and masks duplicate slugs", async () => {
    expect((await POST(request("POST", []))).status).toBe(400);
    mocks.adminCreateBlogCategory.mockRejectedValue(new Error(
      "UNIQUE constraint failed: blog_categories.slug",
    ));
    const response = await POST(request("POST", { name: "Guides" }));
    expect(response.status).toBe(409);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("A category with this slug already exists");
  });
});
