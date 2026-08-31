# Coding Conventions

**Analysis Date:** 2026-08-31

## Naming Patterns

**Files:**
- `PascalCase` for components: `ProductCard.tsx`, `OrderConfirmation.tsx`
- `camelCase` for utilities and libraries: `image-loader.ts`, `checkout-pricing.ts`
- `kebab-case` for directories: `lib/gift-cards/`, `lib/order-status/`
- Test files: `{name}.test.ts` suffix (e.g., `agent-chat-limits.test.ts`)

**Functions:**
- `camelCase` for all functions: `getProduct()`, `selectRecentOrders()`, `recordTelemetry()`
- Getter functions use `get` prefix: `getProduct()`, `getDbAsync()`, `getSettings()`
- Validation functions use assertion pattern: `assertGiftCardId()`, `assertBoundedText()`
- Boolean predicates: `isValidPublicCartItems()`, `isBoundedString()`, `isPlainRecord()`

**Variables:**
- `camelCase` for all variables: `totalAmount`, `shippingAddress`, `discountCodes`
- Constants use `UPPER_SNAKE_CASE`: `MAX_CHECKOUT_LINES`, `MAX_DISCOUNT_CODES`, `MAX_HISTORY_MESSAGES`
- Private class fields use `#` prefix: `#minor`, `#currency` (as seen in `Money` class)

**Types:**
- `PascalCase` for all types, interfaces, and classes: `Money`, `CheckoutQuote`, `GiftCardAccount`
- Type unions and discriminated unions: `GiftCardAccountStatus = "active" | "disabled"`
- Generic types: `Partial<PricingDependencies>`, `Record<string, unknown>`

## Code Style

**Formatting:**
- ESLint via `eslint.config.mjs` (direct invocation, not Next.js `next lint`)
- No Prettier config — format per ESLint rules
- 2-space indentation (standard Node.js)
- Use `.mts` and `.mjs` extensions for module scripts (TypeScript and JavaScript modules)

**Linting:**
- ESLint config: `eslint.config.mjs` extends `eslint-config-next/core-web-vitals`
- React Compiler rules currently at WARN level:
  - `react-hooks/set-state-in-effect`
  - `react-hooks/purity`
  - `react-hooks/error-boundaries`
  - `react-hooks/immutability`
- Rules enforced but not fixed until framework issues are resolved separately from rule enforcement

**Imports:**
- All imports use absolute path alias `@/`: `import { Money } from "@/lib/money"`
- Alias defined in `tsconfig.json`: `"@/*": ["./*"]`
- Organize imports: external packages first, then internal `@/` imports

## Structured Comments

**File Headers:**
Every file uses a structured header comment with `=== Section ===` blocks:

```typescript
/**
 * === [Component/Module Name] ===
 *
 * [One-line description]
 *
 * === [Section Name] ===
 * - **[Subsection]**: [Description]
 * - **[Subsection]**: [Description]
 *
 * === [Another Section] ===
 * [Structured description]
 *
 * === [Use Case] ===
 * @returns [Return type and behavior]
 */
```

See `app/page.tsx` for a complete example with sections like Features, Layout Structure, Technical Implementation, Business Logic, and Usage.

**Function Comments:**
- JSDoc style with `@returns` for public functions
- Inline comments explain non-obvious logic
- Example from `lib/money/money.ts`:
  ```typescript
  /** Immutable, currency-aware monetary value held as integer minor units. */
  export class Money {
    // ...
  }
  
  /** Convert a decimal major-unit amount using explicit half-up rounding. */
  static fromMajor(major: number | string, currency = 'USD'): Money {
    // ...
  }
  ```

## Error Handling

**Patterns:**
- Use `Error` for general failures: `throw new Error('Order is not eligible...')`
- Use `TypeError` for type/contract violations: `throw new TypeError('Money currency must be non-empty ISO 4217 code')`
- Use `RangeError` for numeric bounds violations: `throw new RangeError('Money minor units must be a safe integer...')`
- Create domain-specific error classes for anticipated failures:
  ```typescript
  export class PaymentVerificationError extends Error {}
  ```

**Validation Pattern:**
Use TypeScript assertion functions for input validation. This pattern is used throughout `lib/gift-cards/domain.ts`:

```typescript
function assertBoundedText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    value.trim() !== value
  ) {
    throw new TypeError(`${label} must be a bounded non-whitespace string`);
  }
}

export function assertGiftCardId(value: unknown, label = "gift-card id"): asserts value is string {
  assertBoundedText(value, label, 1, 128);
}
```

**Error with Cause:**
```typescript
throw new TypeError(`Money major amount is invalid: ${String(major)}`, { cause: error });
```

## Dependency Injection

**Pattern:**
Services accept an `options` parameter with a `dependencies` property for testability:

```typescript
export async function priceCheckout(
  input: CheckoutPricingInput,
  options: {
    dependencies?: Partial<PricingDependencies>;
    capabilities?: CommerceCapabilities;
  } = {}
): Promise<CheckoutQuote> {
  const deps = { ...defaultDependencies, ...options.dependencies };
  // Use deps.getProduct, deps.getProductVariant, etc.
}
```

See `lib/services/checkout-pricing.ts` for the complete pattern. This allows tests to inject mock implementations without requiring a database.

## Monetary Values

**Convention:**
All monetary values use the immutable `Money` class from `lib/money/money.ts`. Never use floats or strings for money.

**Key Types:**
- `StoredMoney`: `{ amount: number; currency: string }` — minor units (cents), stored in DB
- `MachMoney`: `{ amount: number; currency: string; precision: number }` — decimal major units, for HTTP/MCP
- `Money`: Class instance — immutable, currency-aware, methods for operations

**Pattern:**
```typescript
// Store as minor units
const m = Money.fromMinor(2500, 'USD'); // $25.00

// Convert from decimal
const m2 = Money.fromMajor(25.00, 'USD');

// Operations
const total = subtotal.add(tax);
const discounted = amount.applyRate(0.9); // 10% off, half-up rounding

// Serialize to HTTP response
const response = { amount: m.toMach() };

// Store in database
const stored = m.toJSON(); // { amount: 2500, currency: 'USD' }
```

## Public Request Validation

**Location:** `lib/public-request-validation.ts`

Centralized validation functions for untrusted external input. Use before expensive operations:

```typescript
export function isBoundedString(
  value: unknown,
  maxLength: number,
  options: { allowEmpty?: boolean } = {}
): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  return options.allowEmpty ? true : value.trim().length > 0;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
```

Apply these guards at the HTTP boundary before parsing Money or calling external services.

## Telemetry

**Framework:** `lib/observability/telemetry.ts` exports `recordTelemetry()`

**Usage:**
- Closed event taxonomy defined as `TELEMETRY_EVENTS` constant
- Call signature: `recordTelemetry(event, fields?, error?)`
- Only events in the taxonomy may be recorded

**Example:**
```typescript
recordTelemetry('paid_effect.drain_failed', {
  operation: 'process',
  outcome: 'failed',
  provider: 'd1',
  retryable: true,
  trigger: 'request',
}, error);
```

**Events:**
- `payment.*` — checkout and payment operations
- `subscription.*` — subscription lifecycle
- `order.*` — order persistence and finalization
- `webhook.*` — webhook processing
- `refund.*` — refund operations
- `email.*` — email delivery

Each event has a hardcoded severity and sample rate defined in the constant map.

## Dynamic Route Parameters

**Convention (Next 16):**
Route parameters must be typed as `Promise<{...}>` and awaited:

```typescript
// ✓ Correct
export default async function Page({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  // Use slug here
}

// ✗ Incorrect (will silently break in production)
export default function Page({
  params
}: {
  params: any
}) {
  const { slug } = params; // Sync read does not work
}
```

## Type Re-exports

**Central Location:** `lib/types/index.ts`

All public types are re-exported from the single barrel file. Import from `@/lib/types`:

```typescript
// From index.ts
export * from "./mach";
export * from "./order";
export * from "./userProfile";
// etc.

// Usage anywhere else
import type { Order } from "@/lib/types";
```

## Domain Interfaces

**Pattern:**
Types for domain entities use interface definitions with explicit field types:

```typescript
export interface GiftCardAccount {
  id: string;
  codeHash: GiftCardCodeHash;
  currency: string;
  status: GiftCardAccountStatus;
  issuanceEntryId: string;
  issuanceBusinessKey: string;
  issuedAmount: Money;
  issuedOrderId?: string;
  issuedLineId?: string;
  purchaserCustomerId?: string;
  createdAt: number;
  disabledAt?: number;
}
```

Timestamp fields use `number` (epoch milliseconds).

## Constants and Configuration

**Pattern:**
- Named exports: `export const MAX_CHECKOUT_LINES = 100`
- Grouped by feature in the same file where they're used
- Example from `lib/services/checkout-pricing.ts`:
  ```typescript
  export const MAX_CHECKOUT_LINES = 100;
  export const MAX_DISCOUNT_CODES = 25;
  ```

---

*Convention analysis: 2026-08-31*
