export type AdminPlanStatusFilter = "all" | "active" | "inactive";
export type CadenceUnit = "day" | "week" | "month" | "year";

export interface AdminSubscriptionPlan {
  id: string;
  product: { id: string; label: string };
  variant: { id: string; label: string };
  price: { amount: number; currency: string; precision: number };
  cadence: { unit: CadenceUnit; count: number };
  shippingRequired: boolean;
  unitAmountMinor: number;
  stripePriceId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanWrite {
  id: string;
  productId: string;
  variantId: string;
  currency: string;
  unitAmountMinor: number;
  stripePriceId: string;
  cadence: { unit: CadenceUnit; count: number };
  active: boolean;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PRICE_PATTERN = /^price_[A-Za-z0-9]{1,249}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CADENCE_UNITS = new Set<CadenceUnit>(["day", "week", "month", "year"]);
const PLAN_KEYS = new Set([
  "id", "product", "variant", "price", "cadence", "shippingRequired",
  "unitAmountMinor", "stripePriceId", "active", "createdAt", "updatedAt",
]);
const MAX_ADMIN_PLAN_RESPONSE_BYTES = 131_072;

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function boundedLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0
    && new TextEncoder().encode(value).byteLength <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
}

function assertWrite(value: SubscriptionPlanWrite): void {
  if (!ID_PATTERN.test(value.id) || !ID_PATTERN.test(value.productId) || !ID_PATTERN.test(value.variantId)
    || !/^[A-Z]{3}$/.test(value.currency)
    || !Number.isSafeInteger(value.unitAmountMinor) || value.unitAmountMinor < 0
    || !PRICE_PATTERN.test(value.stripePriceId)
    || !CADENCE_UNITS.has(value.cadence.unit)
    || !Number.isSafeInteger(value.cadence.count) || value.cadence.count < 1 || value.cadence.count > 365
    || typeof value.active !== "boolean" || (value.active && value.unitAmountMinor === 0)) {
    throw new Error("Subscription plan fields are invalid");
  }
}

export function parseAdminSubscriptionPlan(value: unknown): AdminSubscriptionPlan {
  if (!plain(value) || !exactKeys(value, PLAN_KEYS)
    || typeof value.id !== "string" || !ID_PATTERN.test(value.id)
    || !plain(value.product) || !exactKeys(value.product, new Set(["id", "label"]))
    || typeof value.product.id !== "string" || !ID_PATTERN.test(value.product.id)
    || !boundedLabel(value.product.label)
    || !plain(value.variant) || !exactKeys(value.variant, new Set(["id", "label"]))
    || typeof value.variant.id !== "string" || !ID_PATTERN.test(value.variant.id)
    || !boundedLabel(value.variant.label)
    || !plain(value.price) || !exactKeys(value.price, new Set(["amount", "currency", "precision"]))
    || typeof value.price.amount !== "number" || !Number.isFinite(value.price.amount) || value.price.amount < 0
    || typeof value.price.currency !== "string" || !/^[A-Z]{3}$/.test(value.price.currency)
    || !Number.isSafeInteger(value.price.precision) || Number(value.price.precision) < 0
    || Number(value.price.precision) > 4
    || !plain(value.cadence) || !exactKeys(value.cadence, new Set(["unit", "count"]))
    || !CADENCE_UNITS.has(value.cadence.unit as CadenceUnit)
    || !Number.isSafeInteger(value.cadence.count) || Number(value.cadence.count) < 1
    || Number(value.cadence.count) > 365
    || typeof value.shippingRequired !== "boolean"
    || !Number.isSafeInteger(value.unitAmountMinor) || Number(value.unitAmountMinor) < 0
    || typeof value.stripePriceId !== "string" || !PRICE_PATTERN.test(value.stripePriceId)
    || typeof value.active !== "boolean"
    || typeof value.createdAt !== "string" || !ISO_PATTERN.test(value.createdAt)
    || typeof value.updatedAt !== "string" || !ISO_PATTERN.test(value.updatedAt)
    || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))) {
    throw new Error("Subscription plan response was invalid");
  }
  return value as unknown as AdminSubscriptionPlan;
}

export class AdminSubscriptionPlanApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminSubscriptionPlanApiError";
  }
}

function safeApiMessage(status: number, code: string): string {
  if (status === 409 && code === "subscription_plan_price_mismatch") {
    return "The existing Stripe Price does not match these amount, currency, cadence, or activation settings.";
  }
  if (status === 409) {
    return "This plan changed or conflicts with another plan. Reload the latest version and try again.";
  }
  if (status === 503 || code === "subscription_plan_price_unavailable") {
    return "Stripe Price verification is temporarily unavailable. No changes were saved.";
  }
  if (status === 400) return "The plan fields are invalid. Review every binding and try again.";
  if (status === 404) return "The subscription plan no longer exists.";
  return "Subscription plan management is temporarily unavailable.";
}

async function payload(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_ADMIN_PLAN_RESPONSE_BYTES)) {
    throw new Error("Subscription plan response was too large");
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_ADMIN_PLAN_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Subscription plan response was too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof Error && error.message === "Subscription plan response was too large") throw error;
    throw new Error("Subscription plan response was invalid");
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

async function requireSuccess(response: Response, expected: number): Promise<unknown> {
  const body = await payload(response);
  if (response.status === expected) return body;
  const code = plain(body) && typeof body.code === "string" && body.code.length <= 128
    ? body.code
    : "unknown";
  throw new AdminSubscriptionPlanApiError(response.status, code, safeApiMessage(response.status, code));
}

export async function listAdminSubscriptionPlans(
  fetcher: FetchLike,
  options: { filter: AdminPlanStatusFilter; limit: number; offset: number; signal?: AbortSignal },
): Promise<{ plans: AdminSubscriptionPlan[]; total: number; limit: number; offset: number }> {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100
    || !Number.isSafeInteger(options.offset) || options.offset < 0 || options.offset > 1_000_000) {
    throw new Error("Subscription plan pagination is invalid");
  }
  const query = new URLSearchParams({ limit: String(options.limit), offset: String(options.offset) });
  if (options.filter !== "all") query.set("active", String(options.filter === "active"));
  const body = await requireSuccess(await fetcher(`/api/admin/subscription-plans?${query}`, {
    method: "GET", cache: "no-store", signal: options.signal,
  }), 200);
  if (!plain(body) || !exactKeys(body, new Set(["plans", "total", "meta"]))
    || !Array.isArray(body.plans) || body.plans.length > options.limit
    || !Number.isSafeInteger(body.total) || Number(body.total) < 0 || Number(body.total) > 1_000_000
    || !plain(body.meta) || !exactKeys(body.meta, new Set(["limit", "offset"]))
    || body.meta.limit !== options.limit || body.meta.offset !== options.offset) {
    throw new Error("Subscription plan list response was invalid");
  }
  return {
    plans: body.plans.map(parseAdminSubscriptionPlan),
    total: Number(body.total),
    limit: options.limit,
    offset: options.offset,
  };
}

function parsePlanEnvelope(body: unknown): AdminSubscriptionPlan {
  if (!plain(body) || !exactKeys(body, new Set(["plan"]))) {
    throw new Error("Subscription plan response was invalid");
  }
  return parseAdminSubscriptionPlan(body.plan);
}

export async function getAdminSubscriptionPlan(fetcher: FetchLike, id: string): Promise<AdminSubscriptionPlan> {
  if (!ID_PATTERN.test(id)) throw new Error("Subscription plan id is invalid");
  return parsePlanEnvelope(await requireSuccess(await fetcher(
    `/api/admin/subscription-plans/${encodeURIComponent(id)}`,
    { method: "GET", cache: "no-store" },
  ), 200));
}

export async function createAdminSubscriptionPlan(
  fetcher: FetchLike,
  plan: SubscriptionPlanWrite,
): Promise<AdminSubscriptionPlan> {
  assertWrite(plan);
  return parsePlanEnvelope(await requireSuccess(await fetcher("/api/admin/subscription-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  }), 201));
}

export async function updateAdminSubscriptionPlan(
  fetcher: FetchLike,
  current: Pick<AdminSubscriptionPlan, "id" | "updatedAt">,
  patch: Omit<SubscriptionPlanWrite, "id"> | { active: false },
): Promise<AdminSubscriptionPlan> {
  if (!ID_PATTERN.test(current.id) || !ISO_PATTERN.test(current.updatedAt)
    || !Number.isFinite(Date.parse(current.updatedAt))) {
    throw new Error("Subscription plan version is invalid");
  }
  const patchKeys = Object.keys(patch);
  if (patchKeys.length === 1 && patch.active === false) {
    // Exact deactivation patch is intentionally supported without resending
    // mutable fields from a potentially stale list row.
  } else {
    const fullKeys = new Set([
      "productId", "variantId", "currency", "unitAmountMinor",
      "stripePriceId", "cadence", "active",
    ]);
    if (patchKeys.length !== fullKeys.size || patchKeys.some((key) => !fullKeys.has(key))) {
      throw new Error("Subscription plan patch is invalid");
    }
    assertWrite({ id: current.id, ...patch } as SubscriptionPlanWrite);
  }
  return parsePlanEnvelope(await requireSuccess(await fetcher(
    `/api/admin/subscription-plans/${encodeURIComponent(current.id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: current.updatedAt, patch }),
    },
  ), 200));
}
