# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- Components: PascalCase `.tsx` files (`ProductCard.tsx`, `AdminGuard.tsx`, `OrderCard.tsx`)
- Pages/routes: `page.tsx` inside Next.js App Router directories (`app/product/[slug]/page.tsx`)
- API routes: `route.ts` inside `app/api/` directories (`app/api/products/route.ts`)
- Library modules: camelCase or snake_case `.ts` files (`cart-store.ts`, `unified-auth.ts`)
- DB schema: snake_case `.ts` files (`products.ts`, `admin_users.ts`, `couponInstance.ts`)
- Types: camelCase `.ts` files (`cartitem.ts`, `shipping.ts`); MACH types use PascalCase (`Product.ts`, `Address.ts`)
- Hooks: `use` prefix with camelCase (`useCartPersistence.ts`, `useEnhancedUserContext.ts`, `useWebVitals.ts`)
- UI components (shadcn): kebab-case (`alert-dialog.tsx`, `dropdown-menu.tsx`, `toggle-group.tsx`)

**Functions:**
- Use camelCase for all functions: `getProduct()`, `createOrder()`, `hydrateOrder()`
- Async data functions: verb prefix (`getProduct`, `listProducts`, `searchProducts`, `createProduct`, `updateProduct`, `deleteProduct`)
- Validation functions: `validate` prefix (`validateProduct`, `validateProductVariant`)
- Transform/serialization: `serialize`/`deserialize`/`transform` prefix (`serializeProduct`, `deserializeProduct`, `transformProductForDB`)
- Boolean helpers: `is`/`has`/`can` prefix (`isVariantAvailable`, `hasParentType`, `canBeUsedByCustomer`)
- React components: PascalCase function declarations (`ProductCard`, `ProductDisplay`, `Button`)
- Error factories: PascalCase (`AuthenticationError`, `ValidationError`, `ResourceNotFoundError`)

**Variables:**
- Use camelCase for local variables and parameters: `defaultVariant`, `shippingAddr`, `customerId`
- Constants: UPPER_SNAKE_CASE for permission sets (`PERMISSIONS.ORDERS_READ`, `PERMISSIONS.ADMIN_FULL`)
- Database column names: snake_case (`customer_id`, `created_at`, `total_amount`)
- Store names: `use` prefix with PascalCase suffix (`useCartStore`)

**Types/Interfaces:**
- Use PascalCase for all types and interfaces: `Product`, `CartItem`, `AuthResult`, `MCPError`
- Interface props: ComponentName + `Props` suffix (`ProductCardProps`, `ButtonProps`)
- State interfaces: descriptive PascalCase (`CartState`, `AppliedDiscount`)
- API response types: `ApiResponse<T>` generic pattern

## Code Style

**Formatting:**
- No Prettier configured; relies on ESLint with `eslint-config-next`
- 2-space indentation (TypeScript/TSX)
- Semicolons used consistently
- Double quotes for JSX attributes and imports
- Single quotes occasionally used in non-JSX contexts (inconsistent)
- Trailing commas in multi-line structures

**Linting:**
- ESLint v9 with `eslint-config-next` (no custom `.eslintrc` file found)
- TypeScript strict mode enabled in `tsconfig.json`
- Run linting: `npm run lint` (calls `next lint`)

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2017
- Module resolution: bundler
- `any` type used frequently in data hydration/serialization layers (see Concerns)
- Type assertions (`as any`, `as Product`) used in model layers for DB record conversion

## Import Organization

**Order:**
1. Node/framework imports (`next/server`, `react`)
2. Third-party libraries (`@clerk/nextjs/server`, `drizzle-orm`, `zustand`)
3. Internal aliases with `@/` prefix (`@/lib/types`, `@/components/ui`)
4. Relative imports for same-module files (`../../db/schema/products`, `./ProductDisplay`)

**Path Aliases:**
- `@/*` maps to project root (configured in `tsconfig.json`)
- Use `@/lib/*` for library code
- Use `@/components/*` for components
- Use `@/hooks/*` for hooks (from `components.json` shadcn config)

**Barrel Files:**
- `lib/types/index.ts` re-exports all type modules
- `lib/models/index.ts` re-exports all model modules
- `lib/db/schema/index.ts` re-exports all schema modules (with selective exports to avoid naming conflicts)
- Use selective exports to avoid naming conflicts between modules (e.g., `getLocalizedValue` aliased per module)

## Error Handling

**API Route Pattern:**
- Wrap entire handler body in `try/catch`
- Log errors with `console.error('Context string:', error)`
- Return `NextResponse.json({ error: 'User-friendly message' }, { status: 500 })` for generic errors
- Return `NextResponse.json({ error: 'Validation failed', details: [...] }, { status: 400 })` for validation errors
- Check `error instanceof Error` for more specific error responses

```typescript
// Standard API error handling pattern
export async function GET(request: NextRequest) {
  try {
    // ... handler logic
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve products' },
      { status: 500 }
    );
  }
}
```

**MCP Layer:**
- Custom `MCPServerError` class with code, message, details, retryable, suggestion fields (`lib/mcp/error-handler.ts`)
- Factory functions for common errors: `AuthenticationError()`, `ValidationError()`, `ResourceNotFoundError()`, `PaymentError()`
- `createErrorResponse()` and `createHttpErrorResponse()` standardize error format
- Error codes map to HTTP status codes via `getErrorCodeFromStatus()`

**Model Layer:**
- Throw `new Error('...')` for validation failures
- Use `console.error()` for non-fatal parsing errors with fallback values
- Defensive JSON parsing with try/catch and fallback defaults (heavily used in variant deserialization)

**Middleware:**
- Errors in middleware are caught and allow request to continue (`console.error` + `NextResponse.next()`)
- Never block requests due to middleware errors (fail-open pattern)

## Logging

**Framework:** `console` (console.error, console.log)

**Patterns:**
- Use `console.error('Descriptive context:', error)` for errors
- Use `console.log('Action description:', { details })` for audit/info
- Emoji sometimes used in log messages (e.g., `"WARNING: ..."`)
- No structured logging library; all output is `console.*`

## Comments

**When to Comment:**
- Every file has a large block comment header describing features, technical implementation, and usage
- JSDoc `/** ... */` used on exported functions with `@param` and `@returns`
- Inline comments for non-obvious business logic
- Section separator comments using `// === Section Name ===`

**Documentation Block Pattern (heavily used):**
```typescript
/**
 * === Module Name ===
 *
 * Description of the module.
 *
 * === Features ===
 * - **Feature 1**: Description
 * - **Feature 2**: Description
 *
 * === Technical Implementation ===
 * - **Detail 1**: Description
 *
 * === Usage ===
 * ```typescript
 * // code example
 * ```
 */
```

This verbose documentation pattern is used on nearly every file. Follow this pattern for new files.

**JSDoc:**
- Use on all exported functions
- Include `@param` and `@returns` annotations
- Include `@example` blocks for utility functions

## Function Design

**Size:** Functions range widely; some hydration/transform functions are very long (50+ lines). Keep new functions under 40 lines where possible.

**Parameters:**
- Use options objects for functions with 3+ parameters: `listProducts(options: { status?, type?, limit?, offset? })`
- Use positional parameters for 1-2 argument functions: `getProduct(id: string)`
- Destructure request body inline: `const { status, payment_status, ... } = body`

**Return Values:**
- Return `Promise<T | null>` for single-item lookups
- Return `Promise<T[]>` for list operations
- Return `Promise<boolean>` for delete/relationship operations
- API handlers always return `NextResponse.json()`

## API Response Pattern

**MACH-compliant envelope:**
```typescript
const response: ApiResponse<Product[]> = {
  data: products,
  meta: {
    total,
    limit,
    offset,
    schema: "mach:product"
  },
  links: {
    self: `/api/products?limit=${limit}&offset=${offset}`,
    first: `/api/products?limit=${limit}&offset=0`,
    next: `/api/products?limit=${limit}&offset=${offset + limit}`,
    prev: `/api/products?limit=${limit}&offset=${Math.max(0, offset - limit)}`,
    last: `/api/products?limit=${limit}&offset=${Math.floor(total / limit) * limit}`
  }
};
```

Use this envelope pattern for all list API responses. Single-item responses use `{ data, meta: { schema } }`.

## Module Design

**Exports:**
- Named exports for all functions and types (no default exports except React page components)
- React page components use `export default function PageName()`
- React reusable components use `export default function ComponentName()` or named export
- Barrel files (`index.ts`) re-export from sub-modules

**State Management:**
- Zustand stores in `lib/stores/` with `persist` middleware for client state
- React `cache()` for server-side request-level memoization (`lib/db.ts`)
- No React Context providers for app state (Zustand handles it)

## Component Patterns

**Server Components (default):**
- Page components are async server components: `export default async function ProductPage()`
- Use `await` for data fetching directly in component
- Use `notFound()` from `next/navigation` for missing resources
- Use `Promise.all()` for parallel data fetching

**Client Components:**
- Mark with `"use client"` directive at top of file
- Keep client components minimal; push logic to server where possible
- Use `Suspense` boundaries around client components in server layouts

**UI Components (shadcn/ui):**
- Located in `components/ui/`
- Use `cva` (class-variance-authority) for variant styles
- Use `cn()` from `@/lib/utils` for class merging
- Support `asChild` prop via Radix `Slot` for polymorphism
- Follow shadcn/ui "new-york" style with RSC support

---

*Convention analysis: 2026-03-05*
