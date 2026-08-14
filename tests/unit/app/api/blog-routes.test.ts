import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  adminCreateBlogPost: vi.fn(),
  adminListBlogPosts: vi.fn(),
  adminGetBlogPost: vi.fn(),
  adminUpdateBlogPost: vi.fn(),
  adminDeleteBlogPost: vi.fn(),
  getBlogStats: vi.fn(),
  getPublishedBlogPosts: vi.fn(),
  getPublishedBlogPost: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({ checkAdminPermissions: mocks.checkAdminPermissions }));
vi.mock("@/lib/models/blog", () => mocks);

import { NextRequest } from "next/server";
import { GET as adminList, POST as adminCreate } from "@/app/api/admin/blog/route";
import { GET as adminGet, PUT as adminUpdate, DELETE as adminDelete } from "@/app/api/admin/blog/[id]/route";
import { GET as publicList } from "@/app/api/blog/route";
import { GET as publicGet } from "@/app/api/blog/[slug]/route";

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : {
      "content-type": "application/json",
      origin: new URL(url).origin,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Blog APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.adminListBlogPosts.mockResolvedValue([]);
    mocks.getPublishedBlogPosts.mockResolvedValue([]);
  });

  it("authenticates every admin operation before model access", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Sign in" });
    const responses = await Promise.all([
      adminList(request("https://store.test/api/admin/blog")),
      adminCreate(request("https://store.test/api/admin/blog", "POST", {})),
      adminGet(request("https://store.test/api/admin/blog/1"), { params: Promise.resolve({ id: "1" }) }),
      adminUpdate(request("https://store.test/api/admin/blog/1", "PUT", {}), { params: Promise.resolve({ id: "1" }) }),
      adminDelete(request("https://store.test/api/admin/blog/1", "DELETE"), { params: Promise.resolve({ id: "1" }) }),
    ]);
    expect(responses.every(({ status }) => status === 401)).toBe(true);
    expect(mocks.adminListBlogPosts).not.toHaveBeenCalled();
    expect(mocks.adminCreateBlogPost).not.toHaveBeenCalled();
  });

  it("bounds admin pagination and rejects invalid status", async () => {
    const invalid = await adminList(request("https://store.test/api/admin/blog?status=deleted"));
    expect(invalid.status).toBe(400);
    const response = await adminList(request("https://store.test/api/admin/blog?limit=9999&offset=999999"));
    expect(response.status).toBe(200);
    expect(mocks.adminListBlogPosts).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, offset: 10_000 }));
  });

  it("owns audit actor fields instead of trusting request data", async () => {
    mocks.adminCreateBlogPost.mockImplementation(async (value) => value);
    const response = await adminCreate(request("https://store.test/api/admin/blog", "POST", {
      title: "Launch", html: "<p>Body</p>", createdBy: "attacker", updatedBy: "attacker",
    }));
    expect(response.status).toBe(201);
    expect(mocks.adminCreateBlogPost).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: "admin_1", updatedBy: "admin_1",
    }));
  });

  it("maps duplicate slugs to conflict without leaking storage details", async () => {
    mocks.adminCreateBlogPost.mockRejectedValue(new Error("UNIQUE constraint failed: blog_posts.slug"));
    const response = await adminCreate(request("https://store.test/api/admin/blog", "POST", {
      title: "Launch", html: "<p>Body</p>",
    }));
    const body = await response.json() as { error: string };
    expect(response.status).toBe(409);
    expect(body.error).not.toContain("blog_posts");
  });

  it("validates numeric IDs and preserves not-found semantics", async () => {
    expect((await adminGet(request("https://store.test/api/admin/blog/nope"), {
      params: Promise.resolve({ id: "nope" }),
    })).status).toBe(400);
    mocks.adminGetBlogPost.mockResolvedValue(null);
    expect((await adminGet(request("https://store.test/api/admin/blog/3"), {
      params: Promise.resolve({ id: "3" }),
    })).status).toBe(404);
  });

  it("bounds public pagination and masks failures", async () => {
    await publicList(request("https://store.test/api/blog?limit=9999&offset=999999"));
    expect(mocks.getPublishedBlogPosts).toHaveBeenCalledWith({ limit: 100, offset: 10_000 });
    mocks.getPublishedBlogPosts.mockRejectedValue(new Error("private D1 detail"));
    const response = await publicList(request("https://store.test/api/blog"));
    expect(await response.json()).toEqual({ success: false, error: "Failed to fetch posts" });
  });

  it("returns only the public article supplied by the public model", async () => {
    mocks.getPublishedBlogPost.mockResolvedValue({ slug: "launch", title: "Launch", html: "<p>Body</p>" });
    const response = await publicGet(request("https://store.test/api/blog/launch"), {
      params: Promise.resolve({ slug: "launch" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { slug: "launch", title: "Launch", html: "<p>Body</p>" },
    });
  });
});
