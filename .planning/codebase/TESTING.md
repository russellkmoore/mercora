# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- No test framework is installed or configured
- No test runner (Jest, Vitest, Playwright, Cypress) found in `package.json` devDependencies
- No test configuration files exist in the project root
- No `test` script defined in `package.json`

**Assertion Library:**
- None installed

**Run Commands:**
```bash
# No test commands available
npm run lint              # Only linting is available (next lint)
```

## Test File Organization

**Location:**
- No test files exist anywhere in the project (outside `node_modules/`)
- No `__tests__/` directories
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files

**Recommended Structure (if tests are added):**
```
lib/
  models/
    mach/
      products.ts
      products.test.ts        # Co-locate unit tests with source
  utils/
    ratings.ts
    ratings.test.ts
app/
  api/
    products/
      route.ts
      route.test.ts            # Co-locate API route tests
components/
  ProductCard.tsx
  ProductCard.test.tsx         # Co-locate component tests
```

## Test Structure

**No existing patterns to reference.**

**Recommended pattern based on codebase conventions:**
```typescript
// Use describe/it blocks matching existing JSDoc documentation style
describe('Product Model', () => {
  describe('createProduct', () => {
    it('should create a product with valid data', async () => {
      // Arrange
      const productData: Product = { ... };

      // Act
      const result = await createProduct(productData);

      // Assert
      expect(result.id).toBeDefined();
    });

    it('should throw Error for invalid product data', async () => {
      await expect(createProduct({} as Product))
        .rejects.toThrow('Invalid product data provided');
    });
  });
});
```

## Mocking

**Framework:** None installed

**Recommended approach based on architecture:**
- Database calls via `getDbAsync()` in `lib/db.ts` are the primary mock target
- Clerk auth (`@clerk/nextjs/server`) would need mocking for API route tests
- Stripe SDK (`lib/stripe.ts`) would need mocking for payment tests
- Resend email client (`lib/utils/email.ts`) would need mocking for email tests

**What to Mock:**
- `lib/db.ts` - `getDb()` and `getDbAsync()` (Cloudflare D1 database)
- `@clerk/nextjs/server` - `auth()`, `currentUser()`
- External APIs: Stripe, Resend, Cloudflare Workers AI
- `@opennextjs/cloudflare` - `getCloudflareContext()` for env bindings

**What NOT to Mock:**
- Utility functions (`lib/utils.ts`, `lib/utils/ratings.ts`) - test directly
- Type validation functions (`validateProduct`, `validateProductVariant`) - test directly
- Transform/serialize functions - test directly with real data
- Zustand stores - test with real store instances

## Fixtures and Factories

**Test Data:**
- No test fixtures exist
- Seed data exists in `lib/db/seed-clean/` which could serve as fixture templates
- SQL dump exists at `mercora-db-dump.sql` with production-like data

**Recommended fixture location:**
- `lib/test/fixtures/` for shared test data
- `lib/test/helpers/` for test utilities and factory functions

## Coverage

**Requirements:** None enforced - no coverage tooling configured

**Recommended setup:**
```bash
# If Vitest is adopted:
npx vitest run --coverage
```

## Test Types

**Unit Tests (highest priority to add):**
- Model layer functions in `lib/models/mach/*.ts` - CRUD operations, validation, serialization
- Utility functions in `lib/utils/*.ts` - price formatting, ratings, recommendations
- Schema validation in `lib/db/schema/*.ts` - `validateProduct()`, `serializeProduct()`, `deserializeProduct()`
- MCP error handler in `lib/mcp/error-handler.ts` - error factory functions
- Cart store in `lib/stores/cart-store.ts` - state management logic

**Integration Tests (medium priority):**
- API route handlers in `app/api/*/route.ts` - request/response cycles
- Authentication flow in `lib/auth/unified-auth.ts` (currently disabled)
- Email sending in `lib/utils/email.ts` and `lib/utils/review-notifications.ts`

**E2E Tests:**
- Not used and no framework installed
- Checkout flow, order management, and admin workflows are candidates

## Validation as Proxy for Tests

The codebase uses runtime validation functions that serve as a partial substitute for tests:

```typescript
// lib/db/schema/products.ts
export function validateProduct(data: any): data is Product {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    (typeof data.name === 'string' || (typeof data.name === 'object' && data.name !== null))
  );
}
```

These validators are called at model-layer boundaries but have no test coverage themselves.

## Recommended Test Setup

Given the Cloudflare Workers/D1 edge runtime, the recommended test framework is **Vitest** with the following rationale:
- Native ESM support matches the project's module system
- Faster than Jest for TypeScript projects
- Compatible with Cloudflare Workers testing via `@cloudflare/vitest-pool-workers`
- Similar API to Jest for low migration cost

**Suggested `package.json` additions:**
```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@cloudflare/vitest-pool-workers": "^0.5.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Suggested `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

## Critical Untested Areas

**Highest risk without tests:**
1. Variant deserialization logic in `lib/models/mach/products.ts` - duplicated 4+ times with complex JSON parsing and fallback handling
2. Order creation flow in `app/api/orders/route.ts` - payment, customer creation, email sending
3. Cart discount calculations in `lib/stores/cart-store.ts` - multiple discount types with percentage/fixed parsing from display strings
4. MCP tool handlers in `lib/mcp/tools/*.ts` - agent commerce operations

---

*Testing analysis: 2026-03-05*
