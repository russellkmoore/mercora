import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  isSuperAdminActor: vi.fn(),
  getDbAsync: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
  isSuperAdminActor: mocks.isSuperAdminActor,
}));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/settings/route";

function request(value: boolean) {
  return new NextRequest("https://store.example.test/api/admin/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://store.example.test",
    },
    body: JSON.stringify({
      updates: [{ key: "cms.custom_js_enabled", value, category: "cms" }],
    }),
  });
}

describe("admin custom JavaScript setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
  });

  it("rejects an ordinary admin before loading the database", async () => {
    const response = await POST(request(true));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Only a database super-admin may enable custom JavaScript.",
    });
    expect(mocks.isSuperAdminActor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin_1" }),
    );
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("does not permit service or development identities to enable it", async () => {
    for (const identity of [
      { success: true, userId: "admin-service", isServiceToken: true },
      { success: true, userId: "dev-admin", isDevMode: true },
    ]) {
      mocks.checkAdminPermissions.mockResolvedValueOnce(identity);
      const response = await POST(request(true));
      expect(response.status).toBe(403);
    }
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });
});
