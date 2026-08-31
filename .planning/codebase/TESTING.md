# Testing Patterns

**Analysis Date:** 2026-08-31

## Test Framework

**Runner:**
- Vitest 4.1.10
- Config: `vitest.config.mts` (unit tests), `vitest.workers.config.mts` (integration), `vitest.observability.config.mts` (Durable Objects)

**Assertion Library:**
- Vitest's built-in `expect()` API

**Run Commands:**
```bash
npm run test              # Run unit tests only
npm run test:workers      # Run integration tests (D1 + workers)
npm run test:observability-worker  # Run Durable Object tests
npm run test:watch        # Watch mode (all unit tests)
```

**CI Pipeline:** `.github/workflows/ci.yml` runs all three test suites, plus linting, typecheck, and cf-typecheck.

## Test File Organization

**Locations:**
- Unit tests: `tests/unit/**/*.test.ts` (233 files / 1701 tests)
- Integration tests: `tests/integration/**/*.test.ts` (D1 database tests)
- Worker tests: `tests/workers/**/*.test.ts` (Durable Object tests)

**Naming Convention:**
- All test files end with `.test.ts`
- Name matches the module being tested: `agent-chat-limits.ts` → `tests/unit/agent-chat-limits.test.ts`
- Feature-based grouping: `tests/unit/lib/`, `tests/unit/api/`, `tests/unit/app/`, `tests/unit/components/`

**Total Count:** 261 test files

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";

describe("moduleName", () => {
  it("should do X when given Y", () => {
    // Arrange
    const input = {...};
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
  
  it("handles edge case: empty input", () => {
    expect(functionUnderTest([])).toEqual([]);
  });
});
```

**Patterns Observed:**
- No setup/teardown hooks at describe level (setUp/tearDown) — only `beforeEach`/`afterEach` when needed
- Assertions are direct: `expect(value).toBe(expected)`, not chained
- Descriptive test names that read like sentences: "keeps the newest orders", "treats an unparseable timestamp as undated"
- No nested describe blocks (flat structure preferred)

**Example from `tests/unit/agent-chat-limits.test.ts`:**
```typescript
describe("selectRecentOrders", () => {
  it("bounds a history the chat route would otherwise reject", () => {
    const orders = Array.from({ length: 9 }, (_, i) =>
      order(`o${i}`, `2026-01-0${(i % 9) + 1}T00:00:00.000Z`),
    );
    expect(selectRecentOrders(orders)).toHaveLength(MAX_ORDERS);
  });

  it("keeps the newest orders", () => {
    const selected = selectRecentOrders([
      order("old", "2024-01-01T00:00:00.000Z"),
      order("newest", "2026-08-01T00:00:00.000Z"),
      order("mid", "2025-06-01T00:00:00.000Z"),
      order("oldest", "2023-01-01T00:00:00.000Z"),
    ]);
    expect(selected.map(({ id }) => id)).toEqual(["newest", "mid", "old"]);
  });
});
```

## Mocking

**Framework:** Vitest's `vi` object

**Environment Variable Mocking:**
```typescript
import { afterEach, describe, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cloudflareLoader", () => {
  it("uses a same-origin media fallback when no CDN is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", undefined);
    expect(cloudflareLoader(args)).toBe("/media/products/example.png");
  });
});
```

**Module Mocking:**
```typescript
vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/sanitize-html-server", () => ({
  sanitizePageHtmlServer: (html: string) => html,
  sanitizeRichHtmlServer: (html: string) => html,
}));
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));
```

**Time Mocking:**
```typescript
vi.setSystemTime(new Date(200_000));
// Test code runs with system time frozen at this date
```

**What to Mock:**
- Environment variables that change behavior (NODE_ENV, API endpoints, feature flags)
- Module imports like `server-only` that have side effects
- External services when testing business logic in isolation
- Never mock: `Money` class, validation functions, actual calculation logic

**What NOT to Mock:**
- Database queries in integration tests (use real D1 via `cloudflareTest`)
- Core domain classes like `Money`
- Helper functions used for test setup (factories, fixtures)

## Fixtures and Factories

**Test Factories:**
Simple factory functions create test data:

```typescript
// From tests/unit/agent-chat-limits.test.ts
const order = (id: string, created_at?: string) => ({ id, created_at });
const turn = (i: number, content = `m${i}`) => ({ role: "user", content });

// Usage
const orders = Array.from({ length: 9 }, (_, i) =>
  order(`o${i}`, `2026-01-0${(i % 9) + 1}T00:00:00.000Z`),
);
```

**Seed Functions (Integration Tests):**
For D1 tests, helper functions populate baseline data:

```typescript
// From tests/integration/subscriptions-foundation.test.ts
async function seedPopulatedBaseline() {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO products (id, name, status, default_variant_id)
    VALUES ('prod-existing', 'Existing product', 'active', 'var-existing')
  `).run();
  // ... more seeding
}

async function seedSubscription() {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subscription_plans (...)
    VALUES ('plan-monthly', ...)
  `).run();
  // ... more seeding
}
```

**Fixture Location:**
- `tests/integration/helpers/d1.ts` — Database helper exports `applyTestMigrations()`
- Seed functions defined inline in test files where they're used
- No dedicated fixtures directory — keep test setup close to test code

## Unit Tests

**Scope:**
- Pure functions and logic without database
- Simple imports and straightforward assertions
- Configuration and constants
- Validation and parsing
- Component rendering snapshots (not yet used, but structure exists in `tests/unit/components/`)

**Environment:**
- `environment: "node"` in `vitest.config.mts`
- Tests run in Node environment, not jsdom
- No browser APIs available

**Example Structure:**
```typescript
describe("selectRecentHistory", () => {
  const turn = (i: number, content = `m${i}`) => ({ role: "user", content });

  it("bounds a conversation the chat route would otherwise reject", () => {
    const messages = Array.from({ length: 30 }, (_, i) => turn(i));
    expect(selectRecentHistory(messages)).toHaveLength(MAX_HISTORY_MESSAGES);
  });

  it("keeps the latest turns, not the earliest", () => {
    const messages = Array.from({ length: 15 }, (_, i) => turn(i));
    const selected = selectRecentHistory(messages);
    expect(selected[0].content).toBe("m3");
    expect(selected[selected.length - 1].content).toBe("m14");
  });

  it("trims a turn longer than the route accepts", () => {
    const long = turn(0, "x".repeat(MAX_HISTORY_CONTENT_LENGTH + 500));
    expect(selectRecentHistory([long])[0].content).toHaveLength(MAX_HISTORY_CONTENT_LENGTH);
  });

  it("leaves short turns untouched", () => {
    const messages = [turn(0, "hello")];
    expect(selectRecentHistory(messages)[0]).toBe(messages[0]);
  });

  it("handles an empty conversation", () => {
    expect(selectRecentHistory([])).toEqual([]);
  });
});
```

## Integration Tests

**Scope:**
- Real D1 database via `cloudflareTest` pool
- Migration execution and schema validation
- Model queries and data persistence
- Feature interactions

**Environment:**
- `vitest.workers.config.mts` configuration
- Uses `cloudflareTest` plugin from `@cloudflare/vitest-pool-workers`
- D1 database available at `env.DB`
- Migrations applied via `applyD1Migrations()`

**Setup Pattern:**
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { applyTestMigrations } from "./helpers/d1";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));

beforeEach(async () => {
  await applyTestMigrations();
});

describe("real D1 public content visibility", () => {
  it("hides draft, future, protected, and reserved CMS rows", async () => {
    // Insert test data
    await env.DB.prepare(`
      INSERT INTO pages (title, slug, content, status, published_at, is_protected, show_in_nav)
      VALUES (?, ?, '<p>Body</p>', ?, ?, ?, 1)
    `).bind(title, slug, status, publishedAt, isProtected).run();

    // Query and verify
    const published = await getPublishedPages();
    expect(published.map(({ slug }) => slug)).toContain("visible-page");
  });
});
```

**Database Seeding:**
- Call `applyTestMigrations()` in `beforeEach`
- Insert test data directly using `env.DB.prepare().bind().run()`
- Use factory functions for complex data structures

## Worker Tests (Durable Objects)

**Scope:**
- Durable Object classes
- Worker request/response handling
- Observability tail worker

**Config:** `vitest.observability.config.mts`

**Setup:**
```typescript
cloudflareTest({
  main: './workers/observability-tail/src/index.ts',
  miniflare: {
    compatibilityDate: '2026-08-06',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: {
      ALERT_COOLDOWN: { className: 'AlertCooldown', useSQLite: true },
    },
  },
})
```

## Async Testing

**Pattern:**
Test functions are async when they use async operations:

```typescript
it("enforces Blog scheduling and strips private/editor fields", async () => {
  const insert = env.DB.prepare(`INSERT INTO blog_posts (...)`);
  await env.DB.batch([
    insert.bind(...),
    insert.bind(...),
  ]);

  const list = await getPublishedBlogPosts({ now: 200, limit: 100 });
  expect(list.map(({ slug }) => slug)).toEqual(["visible-post"]);
});
```

**Awaiting Database Operations:**
All D1 operations use `await`:
```typescript
await env.DB.prepare(...).bind(...).run();
const row = await env.DB.prepare(...).first<Type>();
```

**Promise-based Assertions:**
```typescript
await expect(getPublishedBlogPost("future-post", 200)).resolves.toBeNull();
await expect(getPublishedBlogPost("draft-post", 200)).resolves.toBeNull();
```

## Error Testing

**Pattern:**
Test expected exceptions and error conditions:

```typescript
it("does not mutate the caller's array", () => {
  const orders = [order("a", "2024-01-01T00:00:00.000Z"), order("b", "2026-01-01T00:00:00.000Z")];
  selectRecentOrders(orders);
  expect(orders.map(({ id }) => id)).toEqual(["a", "b"]); // Original unchanged
});

it("handles fewer orders than the bound", () => {
  expect(selectRecentOrders([order("only", "2026-01-01T00:00:00.000Z")])).toHaveLength(1);
});
```

## Coverage

**Requirements:** Not enforced (no coverage target configured)

**View Coverage:**
```bash
npm run test -- --coverage
```

Configuration is in `vitest.config.mts` if coverage reporting is enabled.

## Clean-up

**Environment Variables:**
```typescript
afterEach(() => {
  vi.unstubAllEnvs();
});
```

**Mocks:**
Vitest's `clearMocks: true` in config automatically clears mocks between tests.

## Test Organization Best Practices

**When to add tests:**
- All public functions should have at least basic test coverage
- Monetary calculations always need tests (Money class operations)
- Database queries and models tested via integration tests
- Edge cases: empty inputs, large inputs, null/undefined, type mismatches
- Async operations and error paths

**When NOT to test:**
- Internal helper functions (test their consumers instead)
- Logging output (unless it's a critical audit trail)
- Trivial getters and setters (unless they have side effects)

**Test file templates:**
- Simple: `describe(name) { it() { } }`
- With setup: Add `beforeEach`, but keep it minimal
- Database: Use `beforeEach(applyTestMigrations)` then insert data
- Complex mocking: Group mocks at top, then `describe`/`it` blocks

---

*Testing analysis: 2026-08-31*
