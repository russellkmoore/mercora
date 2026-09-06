/**
 * === Route Template Mapper ===
 *
 * Maps an arbitrary, possibly hostile, pathname string to one of a fixed,
 * ASCII, index-cap-safe set of route templates. Used exclusively to derive
 * the Analytics Engine index value for web-vitals beacons — see
 * `app/api/analytics/vitals/route.ts`.
 *
 * === Design ===
 * - Pure. No imports, no state, no I/O. Same input always returns the same
 *   output, and the output is always a member of `ROUTE_TEMPLATES`.
 * - The output set is fixed at build time (D-03): attacker-supplied beacon
 *   text can never introduce a new index bucket. Anything unrecognized
 *   falls into `OTHER_ROUTE_TEMPLATE`.
 * - Defensive ordering mirrors `queryFreePath` in `lib/observability/telemetry.ts`:
 *   reject non-pathnames and oversized input first, strip query/fragment,
 *   reject control characters, then match against a static segment table.
 */

const HOME = "/";
const PRODUCT = "/product/[slug]";
const CATEGORY = "/category/[slug]";
const BLOG = "/blog/[slug]";
const ORDER_STATUS = "/order-status/[id]";
const ACCOUNT_ORDER = "/account/orders/[id]";
const ADMIN_ORDER = "/admin/orders/[id]";
const ADMIN_BLOG = "/admin/blog/[id]";
const ADMIN_CATEGORY = "/admin/categories/[id]";
const CHECKOUT = "/checkout";
const CART = "/cart";

/** Single fallback bucket for every path the static table does not recognize. */
export const OTHER_ROUTE_TEMPLATE = "/other" as const;

/** Every possible value `toRouteTemplate` can return, including the fallback. */
export const ROUTE_TEMPLATES: ReadonlySet<string> = new Set([
  HOME,
  PRODUCT,
  CATEGORY,
  BLOG,
  ORDER_STATUS,
  ACCOUNT_ORDER,
  ADMIN_ORDER,
  ADMIN_BLOG,
  ADMIN_CATEGORY,
  CHECKOUT,
  CART,
  OTHER_ROUTE_TEMPLATE,
]);

/** Exact-string matches for static pages that carry commerce traffic. */
const STATIC_EXACT: ReadonlyMap<string, string> = new Map([
  [HOME, HOME],
  [CHECKOUT, CHECKOUT],
  [CART, CART],
]);

interface DynamicRoute {
  /** Leading literal segments (in order) that identify this route. */
  readonly prefix: readonly string[];
  /** Total segment count the path must have (prefix length + dynamic slug segments). */
  readonly segmentCount: number;
  readonly template: string;
}

/**
 * Segment-count-plus-prefix match instead of a regular expression per page —
 * the output set is fixed at build time, and a segment comparison makes that
 * obvious to a reader (D-03).
 */
const DYNAMIC_ROUTES: readonly DynamicRoute[] = [
  { prefix: ["product"], segmentCount: 2, template: PRODUCT },
  { prefix: ["category"], segmentCount: 2, template: CATEGORY },
  { prefix: ["blog"], segmentCount: 2, template: BLOG },
  { prefix: ["order-status"], segmentCount: 2, template: ORDER_STATUS },
  { prefix: ["account", "orders"], segmentCount: 3, template: ACCOUNT_ORDER },
  { prefix: ["admin", "orders"], segmentCount: 3, template: ADMIN_ORDER },
  { prefix: ["admin", "blog"], segmentCount: 3, template: ADMIN_BLOG },
  { prefix: ["admin", "categories"], segmentCount: 3, template: ADMIN_CATEGORY },
];

const MAX_RAW_LENGTH = 512;
const MAX_PATH_LENGTH = 128;
// Same control-character range `queryFreePath` rejects: U+0000-U+001F plus U+007F.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function matchDynamicRoute(segments: readonly string[]): string | undefined {
  for (const route of DYNAMIC_ROUTES) {
    if (segments.length !== route.segmentCount) continue;
    if (route.prefix.every((segment, index) => segments[index] === segment)) {
      return route.template;
    }
  }
  return undefined;
}

/**
 * Maps an arbitrary value — normally `window.location.pathname` from a
 * web-vitals beacon, but attacker-controllable — to a fixed route template.
 * Total over all inputs: never throws, always returns a member of
 * `ROUTE_TEMPLATES`.
 */
export function toRouteTemplate(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > MAX_RAW_LENGTH) {
    return OTHER_ROUTE_TEMPLATE;
  }

  const withoutQueryOrFragment = value.split(/[?#]/, 1)[0] ?? "";
  if (
    withoutQueryOrFragment.length === 0 ||
    withoutQueryOrFragment.length > MAX_PATH_LENGTH ||
    CONTROL_CHARS.test(withoutQueryOrFragment)
  ) {
    return OTHER_ROUTE_TEMPLATE;
  }

  const exact = STATIC_EXACT.get(withoutQueryOrFragment);
  if (exact) return exact;

  const segments = withoutQueryOrFragment.slice(1).split("/");
  const dynamic = matchDynamicRoute(segments);
  return dynamic ?? OTHER_ROUTE_TEMPLATE;
}
