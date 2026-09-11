import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDbAsync: vi.fn(), getStoreConfig: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/utils/sanitize-html-server", async () => {
  const core = await import("@/lib/utils/sanitize-html-core");
  return { sanitizeRichHtmlServer: core.sanitizeRichHtmlServer };
});

import { getPublishedBlogPosts, adminListBlogPosts } from "@/lib/models/blog";

/**
 * A chainable fake matching the real chain shape:
 * `db.select(columns).from(table).where(...).orderBy(...).limit(n).offset(n)`.
 * Every chain method after `select` returns the same object (self-chaining)
 * and records the arguments it was called with; the object itself is
 * thenable so the final `await` on the chain resolves to `rows`.
 */
function buildChainableDb(rows: unknown[]) {
  const recordedColumns: Record<string, unknown>[] = [];
  const recordedCalls: {
    from: unknown[][];
    where: unknown[][];
    orderBy: unknown[][];
    limit: unknown[][];
    offset: unknown[][];
  } = { from: [], where: [], orderBy: [], limit: [], offset: [] };

  const chain: {
    from: (...args: unknown[]) => typeof chain;
    where: (...args: unknown[]) => typeof chain;
    orderBy: (...args: unknown[]) => typeof chain;
    limit: (...args: unknown[]) => typeof chain;
    offset: (...args: unknown[]) => typeof chain;
    $dynamic: (...args: unknown[]) => typeof chain;
    then: (
      onFulfilled: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    from: (...args: unknown[]) => {
      recordedCalls.from.push(args);
      return chain;
    },
    where: (...args: unknown[]) => {
      recordedCalls.where.push(args);
      return chain;
    },
    orderBy: (...args: unknown[]) => {
      recordedCalls.orderBy.push(args);
      return chain;
    },
    limit: (...args: unknown[]) => {
      recordedCalls.limit.push(args);
      return chain;
    },
    offset: (...args: unknown[]) => {
      recordedCalls.offset.push(args);
      return chain;
    },
    // adminListBlogPosts's own chain calls `.$dynamic()` between `.from()`
    // and the conditional `.where()`; a no-op passthrough keeps that path
    // usable by this same fake.
    $dynamic: () => chain,
    then: (onFulfilled, onRejected) => Promise.resolve(rows).then(onFulfilled, onRejected),
  };

  const select = vi.fn((columns: Record<string, unknown>) => {
    recordedColumns.push(columns);
    return chain;
  });

  return { select, recordedColumns, recordedCalls };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Post",
    slug: "post",
    author: "Editorial team",
    excerpt: null,
    tags: "[]",
    coverImageUrl: null,
    coverImageAlt: null,
    status: "published",
    readingTime: 1,
    publishedAt: 100,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe("getPublishedBlogPosts — opt-in HTML column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects exactly the 13 existing columns by default, no body member", async () => {
    const db = buildChainableDb([row()]);
    mocks.getDbAsync.mockResolvedValue(db);

    const result = await getPublishedBlogPosts({ now: 200 });

    expect(db.select).toHaveBeenCalledTimes(1);
    const columns = db.recordedColumns[0];
    expect(Object.keys(columns).sort()).toEqual([
      "author", "coverImageAlt", "coverImageUrl", "createdAt", "excerpt", "id",
      "publishedAt", "readingTime", "slug", "status", "tags", "title", "updatedAt",
    ]);
    expect(columns).not.toHaveProperty("html");
    expect(result[0]).not.toHaveProperty("html");
  });

  it("selects those 13 columns plus html when includeHtml is true", async () => {
    const db = buildChainableDb([row({ html: "<p>Body</p>" })]);
    mocks.getDbAsync.mockResolvedValue(db);

    const result = await getPublishedBlogPosts({ now: 200, includeHtml: true });

    const columns = db.recordedColumns[0];
    expect(columns).toHaveProperty("html");
    expect(Object.keys(columns)).toHaveLength(14);
    expect(result[0]).toHaveProperty("html", "<p>Body</p>");
  });

  it("produces a summary with no html member at all (not set to undefined) for a row without a body", async () => {
    const db = buildChainableDb([row()]);
    mocks.getDbAsync.mockResolvedValue(db);

    const result = await getPublishedBlogPosts({ now: 200 });

    expect("html" in result[0]).toBe(false);
  });

  it("uses the same filter, ordering, limit and offset whether or not includeHtml is set", async () => {
    const defaultDb = buildChainableDb([row()]);
    mocks.getDbAsync.mockResolvedValueOnce(defaultDb);
    await getPublishedBlogPosts({ now: 500, limit: 10, offset: 5 });

    const optedInDb = buildChainableDb([row({ html: "<p>Body</p>" })]);
    mocks.getDbAsync.mockResolvedValueOnce(optedInDb);
    await getPublishedBlogPosts({ now: 500, limit: 10, offset: 5, includeHtml: true });

    expect(optedInDb.recordedCalls.where).toEqual(defaultDb.recordedCalls.where);
    expect(optedInDb.recordedCalls.orderBy).toEqual(defaultDb.recordedCalls.orderBy);
    expect(optedInDb.recordedCalls.limit).toEqual(defaultDb.recordedCalls.limit);
    expect(optedInDb.recordedCalls.offset).toEqual(defaultDb.recordedCalls.offset);
  });

  it("clamps limit and offset identically to the pre-existing behavior", async () => {
    const db = buildChainableDb([row()]);
    mocks.getDbAsync.mockResolvedValue(db);

    await getPublishedBlogPosts({ now: 200, limit: 99999, offset: -5, includeHtml: true });

    expect(db.recordedCalls.limit[0]).toEqual([100]);
    expect(db.recordedCalls.offset[0]).toEqual([0]);
  });
});

describe("adminListBlogPosts — never reaches the HTML opt-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects exactly the same 13 columns as getPublishedBlogPosts's default call", async () => {
    const db = buildChainableDb([row()]);
    mocks.getDbAsync.mockResolvedValue(db);

    await adminListBlogPosts();

    const columns = db.recordedColumns[0];
    expect(columns).not.toHaveProperty("html");
    expect(Object.keys(columns)).toHaveLength(13);
  });
});
