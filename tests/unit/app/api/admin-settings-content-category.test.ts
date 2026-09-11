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
import { GET, POST } from "@/app/api/admin/settings/route";
import { defaultSettings } from "@/lib/db/schema/settings";
import { CONTENT_SETTING_DEFAULTS, CONTENT_SETTING_KEYS } from "@/lib/content/settings";
import { HONOR_GUARD_SETTING_KEY } from "@/lib/gift-cards/honor-guard";

function getRequest(category?: string) {
  const url = category
    ? `https://store.example.test/api/admin/settings?category=${category}`
    : "https://store.example.test/api/admin/settings";
  return new NextRequest(url, { method: "GET" });
}

function postRequest(updates: unknown[]) {
  return new NextRequest("https://store.example.test/api/admin/settings", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://store.example.test" },
    body: JSON.stringify({ updates }),
  });
}

/**
 * A mocked drizzle-shaped db whose `select().from()` result is itself
 * awaitable (the unfiltered path) AND chainable via `.where()` (the
 * category-scoped path). Copied verbatim from
 * tests/unit/app/api/admin-settings-empty-category.test.ts, whose own
 * `buildDb()` this harness mirrors, so the GET-side seeding assertions here
 * exercise the exact same route code path.
 */
function buildDb() {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn(() => ({ values: insertValues }));
  const whereMock = vi.fn();
  const unfilteredMock = vi.fn();

  const from = vi.fn(() => ({
    where: whereMock,
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(unfilteredMock()).then(onFulfilled, onRejected),
  }));

  const select = vi.fn(() => ({ from }));

  return { select, insert, insertValues, onConflictDoNothing, whereMock, unfilteredMock, from };
}

/**
 * A mocked db shaped for the POST per-update write loop: `updateCount`
 * `select()` calls return the `{ limit }` shape the existing-row check
 * uses, resolving to an empty array — no row exists yet, so the route
 * takes its `insert` branch, matching a first save into a freshly-seeded
 * table. Every later `select()` call (the final `updatedSettings`
 * re-select) falls back to a plain awaited `.where()`. `insert().values()`
 * calls are captured so tests can assert the exact rows written.
 */
function buildWriteDb(updateCount: number) {
  const insertCalls: Record<string, unknown>[] = [];
  const insertValues = vi.fn((data: Record<string, unknown>) => {
    insertCalls.push(data);
    return Promise.resolve(undefined);
  });
  const insert = vi.fn(() => ({ values: insertValues }));
  const select = vi.fn();
  for (let i = 0; i < updateCount; i++) {
    select.mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }));
  }
  select.mockImplementation(() => ({ from: () => ({ where: async () => [] }) }));

  return {
    select,
    insert,
    insertCalls,
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
}

function contentUpdates() {
  return [
    { key: CONTENT_SETTING_KEYS.blogNavLabel, value: "News", category: "content" },
    { key: CONTENT_SETTING_KEYS.blogHomeBlockEnabled, value: true, category: "content" },
    { key: CONTENT_SETTING_KEYS.blogHomeBlockHeading, value: "Latest", category: "content" },
    { key: CONTENT_SETTING_KEYS.blogHomeBlockCount, value: 4, category: "content" },
    { key: CONTENT_SETTING_KEYS.blogHomeBlockPlacement, value: "before_featured", category: "content" },
  ];
}

describe("content settings — defaultSettings shape (D-15)", () => {
  it("has exactly five content rows matching CONTENT_SETTING_KEYS, CONTENT_SETTING_DEFAULTS and their data_type", () => {
    const contentDefaults = defaultSettings.filter((s) => s.category === "content");
    expect(contentDefaults).toHaveLength(5);

    const expectedKeys = new Set(Object.values(CONTENT_SETTING_KEYS));
    expect(new Set(contentDefaults.map((row) => row.key))).toEqual(expectedKeys);

    const byKey = new Map(contentDefaults.map((row) => [row.key, row]));

    const navLabel = byKey.get(CONTENT_SETTING_KEYS.blogNavLabel)!;
    expect(JSON.parse(navLabel.value)).toBe(CONTENT_SETTING_DEFAULTS.blogNavLabel);
    expect(navLabel.data_type).toBe("string");

    const enabled = byKey.get(CONTENT_SETTING_KEYS.blogHomeBlockEnabled)!;
    expect(JSON.parse(enabled.value)).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled);
    expect(enabled.data_type).toBe("boolean");

    const heading = byKey.get(CONTENT_SETTING_KEYS.blogHomeBlockHeading)!;
    expect(JSON.parse(heading.value)).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading);
    expect(heading.data_type).toBe("string");

    const count = byKey.get(CONTENT_SETTING_KEYS.blogHomeBlockCount)!;
    expect(JSON.parse(count.value)).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockCount);
    expect(count.data_type).toBe("number");

    const placement = byKey.get(CONTENT_SETTING_KEYS.blogHomeBlockPlacement)!;
    expect(JSON.parse(placement.value)).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement);
    expect(placement.data_type).toBe("string");
  });
});

describe("GET /api/admin/settings?category=content — seeding scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
  });

  it("seeds exactly the five content defaults, and no row of any other category, on an unseeded table", async () => {
    const db = buildDb();
    const contentDefaults = defaultSettings.filter((s) => s.category === "content");
    db.unfilteredMock.mockResolvedValue([]);
    db.whereMock.mockResolvedValueOnce([]).mockResolvedValueOnce(contentDefaults);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await GET(getRequest("content"));

    expect(response.status).toBe(200);
    expect(db.insertValues).toHaveBeenCalledTimes(1);
    expect(db.insertValues).toHaveBeenCalledWith(contentDefaults);
    const inserted = db.insertValues.mock.calls[0][0] as { category: string }[];
    expect(inserted).toHaveLength(5);
    expect(new Set(inserted.map((row) => row.category))).toEqual(new Set(["content"]));
  });

  it("returns 403 and never touches the database when the permission check fails", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Admin access required" });

    const response = await GET(getRequest("content"));

    expect(response.status).toBe(403);
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/settings — content.* write path (T-16-31, T-16-32)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
  });

  it("is not refused by the honor guard and reaches the per-update write loop, writing category 'content' for all five keys", async () => {
    const db = buildWriteDb(5);
    mocks.getDbAsync.mockResolvedValue(db);

    const response = await POST(postRequest(contentUpdates()));

    expect(response.status).toBe(200);
    expect(db.insert).toHaveBeenCalledTimes(5);
    expect(db.insertCalls.every((row) => row.category === "content")).toBe(true);
    expect(new Set(db.insertCalls.map((row) => row.key))).toEqual(new Set(Object.values(CONTENT_SETTING_KEYS)));
  });

  it("refuses the whole batch when a content.* update is mixed with the honor guard key, writing no content.* row", async () => {
    const response = await POST(postRequest([
      ...contentUpdates(),
      { key: HONOR_GUARD_SETTING_KEY, category: "system", data_type: "object", value: { outstanding_minor: 0 } },
    ]));

    expect(response.status).toBe(400);
    // Partial application would leave the content.* half written while the
    // caller has no way to know which half landed — this refusal must be
    // whole-batch, before the database is touched at all.
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it("returns 403 and never touches the database when the permission check fails", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Admin access required" });

    const response = await POST(postRequest(contentUpdates()));

    expect(response.status).toBe(403);
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });
});
