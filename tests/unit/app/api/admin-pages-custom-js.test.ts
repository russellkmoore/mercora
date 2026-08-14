import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  isSuperAdminActor: vi.fn(),
  logCustomJsAudit: vi.fn(),
  getPages: vi.fn(),
  createPage: vi.fn(),
  getPageStats: vi.fn(),
  searchPages: vi.fn(),
  getPageById: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  getPageVersions: vi.fn(),
  publishPage: vi.fn(),
  unpublishPage: vi.fn(),
  archivePage: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
  isSuperAdminActor: mocks.isSuperAdminActor,
}));
vi.mock("@/lib/cms/custom-js-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cms/custom-js-guard")>()),
  logCustomJsAudit: mocks.logCustomJsAudit,
}));
vi.mock("@/lib/models/pages", () => ({
  ...mocks,
  PAGE_STATUS: { PUBLISHED: "published", DRAFT: "draft", ARCHIVED: "archived" },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/pages/route";
import { PUT } from "@/app/api/admin/pages/[id]/route";

function request(method: string, body: unknown) {
  return new NextRequest("https://store.example.test/api/admin/pages", {
    method,
    headers: { "content-type": "application/json", origin: "https://store.example.test" },
    body: JSON.stringify(body),
  });
}

const currentPage = { id: 7, slug: "about", custom_js: "old()" };

describe("admin CMS custom JavaScript writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
    mocks.getPageById.mockResolvedValue(currentPage);
    mocks.createPage.mockResolvedValue({ ...currentPage, custom_js: "new()" });
    mocks.updatePage.mockResolvedValue(currentPage);
  });

  it("rejects a non-super-admin create before persistence", async () => {
    const response = await POST(request("POST", {
      title: "About", slug: "about", content: "<p>Body</p>", custom_js: "new()",
    }));
    expect(response.status).toBe(403);
    expect(mocks.createPage).not.toHaveBeenCalled();
    expect(mocks.logCustomJsAudit).toHaveBeenCalledWith(expect.objectContaining({ allowed: false }));
  });

  it("does not let a service identity bypass the database super-admin gate", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({
      success: true,
      userId: "admin-service",
      isServiceToken: true,
    });
    const response = await POST(request("POST", {
      title: "About", slug: "about", content: "<p>Body</p>", custom_js: "new()",
    }));
    expect(response.status).toBe(403);
    expect(mocks.isSuperAdminActor).toHaveBeenCalledWith(expect.objectContaining({ isServiceToken: true }));
  });

  it("allows an ordinary admin to clear a stored script", async () => {
    mocks.updatePage.mockResolvedValue({ ...currentPage, custom_js: null });
    const response = await PUT(request("PUT", { custom_js: "" }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.isSuperAdminActor).not.toHaveBeenCalled();
    expect(mocks.updatePage).toHaveBeenCalled();
    expect(mocks.logCustomJsAudit).toHaveBeenCalledWith(expect.objectContaining({ allowed: true }));
  });

  it("audits an allowed script change only after persistence", async () => {
    mocks.isSuperAdminActor.mockResolvedValue(true);
    mocks.updatePage.mockRejectedValue(new Error("D1 unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await PUT(request("PUT", { custom_js: "new()" }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(500);
    expect(mocks.logCustomJsAudit).not.toHaveBeenCalledWith(expect.objectContaining({ allowed: true }));
  });

  it("requires a super-admin to publish a page containing stored JavaScript", async () => {
    const denied = await PUT(request("PUT", { action: "publish" }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(denied.status).toBe(403);
    expect(mocks.publishPage).not.toHaveBeenCalled();
    expect(mocks.logCustomJsAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "publish", allowed: false,
    }));

    mocks.isSuperAdminActor.mockResolvedValue(true);
    mocks.publishPage.mockResolvedValue({ ...currentPage, status: "published" });
    const allowed = await PUT(request("PUT", { action: "publish" }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(allowed.status).toBe(200);
    expect(mocks.publishPage).toHaveBeenCalledWith(7, "admin_1");
    expect(mocks.logCustomJsAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "publish", allowed: true,
    }));
  });
});
