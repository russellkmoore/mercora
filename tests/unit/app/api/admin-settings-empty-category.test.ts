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
import { GET } from "@/app/api/admin/settings/route";
import { defaultSettings } from "@/lib/db/schema/settings";

function request(category?: string) {
  const url = category
    ? `https://store.example.test/api/admin/settings?category=${category}`
    : "https://store.example.test/api/admin/settings";
  return new NextRequest(url, { method: "GET" });
}

/**
 * A mocked drizzle-shaped db whose `select().from()` result is itself
 * awaitable (the unfiltered path) AND chainable via `.where()` (the
 * category-scoped path), matching the two call shapes the real handler uses.
 * `whereMock` and `unfilteredMock` are `vi.fn()`s so each test can queue a
 * distinct resolved value per call with `mockResolvedValueOnce`, without
 * needing to parse the `eq()` condition object `.where()` actually receives.
 */
function buildDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: insertValues }));
  const whereMock = vi.fn();
  const unfilteredMock = vi.fn();

  const from = vi.fn(() => ({
    where: whereMock,
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(unfilteredMock()).then(onFulfilled, onRejected),
  }));

  const select = vi.fn(() => ({ from }));

  return { select, insert, insertValues, whereMock, unfilteredMock, from };
}

describe("GET /api/admin/settings — category-scoped seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
  });

  it("returns an empty list for a category with no defaults, on a partially-seeded table, without inserting", async () => {
    const db = buildDb();
    // Partially-seeded table: an unfiltered read would find other categories'
    // rows, but the appearance-filtered read resolves empty both times this
    // handler queries it (initial read, then the scoped re-select).
    db.unfilteredMock.mockResolvedValue([{ key: "system.debug_mode", category: "system" }]);
    db.whereMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(request("appearance"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ settings: [] });
    expect(db.insertValues).not.toHaveBeenCalled();
  });

  it("seeds only the requested category's defaults, strictly fewer rows than the full defaults array", async () => {
    const db = buildDb();
    const systemDefaults = defaultSettings.filter((s) => s.category === "system");
    expect(systemDefaults.length).toBeGreaterThan(0);
    expect(systemDefaults.length).toBeLessThan(defaultSettings.length);

    db.whereMock.mockResolvedValueOnce([]).mockResolvedValueOnce(systemDefaults);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(request("system"));

    expect(response.status).toBe(200);
    expect(db.insertValues).toHaveBeenCalledTimes(1);
    expect(db.insertValues).toHaveBeenCalledWith(systemDefaults);
    const insertedCategories = new Set(
      (db.insertValues.mock.calls[0][0] as { category: string }[]).map((row) => row.category),
    );
    expect(insertedCategories).toEqual(new Set(["system"]));
  });

  it("seeds the full defaults array unchanged when no category is requested on a genuinely empty table", async () => {
    const db = buildDb();
    db.unfilteredMock.mockResolvedValueOnce([]).mockResolvedValueOnce(defaultSettings);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(db.insertValues).toHaveBeenCalledTimes(1);
    expect(db.insertValues).toHaveBeenCalledWith(defaultSettings);
    expect(db.whereMock).not.toHaveBeenCalled();
  });

  it("returns existing rows for an already-seeded category without inserting", async () => {
    const db = buildDb();
    const existingAppearanceRows = [
      { key: "appearance.theme", value: JSON.stringify("luxe"), category: "appearance" },
    ];
    db.whereMock.mockResolvedValueOnce(existingAppearanceRows);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(request("appearance"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ settings: existingAppearanceRows });
    expect(db.insertValues).not.toHaveBeenCalled();
  });

  it("returns 403 and never touches the database when the permission check fails", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Admin access required" });

    const response = await GET(request("appearance"));

    expect(response.status).toBe(403);
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("scopes the post-seed re-select to the requested category, never leaking other categories' rows", async () => {
    const db = buildDb();
    const systemDefaults = defaultSettings.filter((s) => s.category === "system");
    db.whereMock.mockResolvedValueOnce([]).mockResolvedValueOnce(systemDefaults);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(request("system"));

    const body = (await response.json()) as { settings: { category: string }[] };
    expect(body.settings.every((row) => row.category === "system")).toBe(true);
    // Both the initial read and the re-select went through the scoped
    // `.where()` chain — the unfiltered path was never used for this request.
    expect(db.whereMock).toHaveBeenCalledTimes(2);
    expect(db.unfilteredMock).not.toHaveBeenCalled();
  });
});
