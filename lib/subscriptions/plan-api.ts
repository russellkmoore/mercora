import {
  DEFAULT_SUBSCRIPTION_PLAN_LIMIT,
  MAX_SUBSCRIPTION_PLAN_BODY_BYTES,
  MAX_SUBSCRIPTION_PLAN_LIMIT,
  MAX_SUBSCRIPTION_PLAN_OFFSET,
  SubscriptionPlanValidationError,
  type AdminSubscriptionPlanListOptions,
  type PublicSubscriptionPlanListOptions,
  type SubscriptionPlanListOptions,
  type SubscriptionPlanPatch,
  type SubscriptionPlanWrite,
} from "./plan-service";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function parseInteger(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new SubscriptionPlanValidationError("Invalid pagination parameters");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new SubscriptionPlanValidationError("Invalid pagination parameters");
  }
  return parsed;
}

function assertKnownQuery(search: URLSearchParams, allowed: ReadonlySet<string>): void {
  for (const key of search.keys()) {
    if (!allowed.has(key) || search.getAll(key).length !== 1) {
      throw new SubscriptionPlanValidationError("Unknown or repeated query parameter");
    }
  }
}

export function parsePublicPlanQuery(search: URLSearchParams): PublicSubscriptionPlanListOptions {
  assertKnownQuery(search, new Set(["limit", "offset", "productId", "variantId"]));
  const productId = search.get("productId");
  const variantId = search.get("variantId");
  if (productId !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(productId)) {
    throw new SubscriptionPlanValidationError("Product id is invalid");
  }
  if (variantId !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(variantId)) {
    throw new SubscriptionPlanValidationError("Variant id is invalid");
  }
  return {
    limit: parseInteger(search.get("limit"), DEFAULT_SUBSCRIPTION_PLAN_LIMIT, 1, MAX_SUBSCRIPTION_PLAN_LIMIT),
    offset: parseInteger(search.get("offset"), 0, 0, MAX_SUBSCRIPTION_PLAN_OFFSET),
    ...(productId === null ? {} : { productId }),
    ...(variantId === null ? {} : { variantId }),
  };
}

export function parseAdminPlanQuery(search: URLSearchParams): AdminSubscriptionPlanListOptions {
  assertKnownQuery(search, new Set(["limit", "offset", "active"]));
  const active = search.get("active");
  if (active !== null && active !== "true" && active !== "false") {
    throw new SubscriptionPlanValidationError("Active filter must be true or false");
  }
  return {
    ...parseIntegerQuery(search),
    ...(active === null ? {} : { active: active === "true" }),
  };
}

function parseIntegerQuery(search: URLSearchParams): SubscriptionPlanListOptions {
  return {
    limit: parseInteger(search.get("limit"), DEFAULT_SUBSCRIPTION_PLAN_LIMIT, 1, MAX_SUBSCRIPTION_PLAN_LIMIT),
    offset: parseInteger(search.get("offset"), 0, 0, MAX_SUBSCRIPTION_PLAN_OFFSET),
  };
}

async function boundedText(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_SUBSCRIPTION_PLAN_BODY_BYTES)) {
    throw new SubscriptionPlanValidationError("Request body is too large");
  }
  if (!request.body) throw new SubscriptionPlanValidationError("JSON request body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_SUBSCRIPTION_PLAN_BODY_BYTES) {
        await reader.cancel();
        throw new SubscriptionPlanValidationError("Request body is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof SubscriptionPlanValidationError) throw error;
    throw new SubscriptionPlanValidationError("Request body must be valid UTF-8 JSON");
  } finally {
    reader.releaseLock();
  }
  if (!text.trim()) throw new SubscriptionPlanValidationError("JSON request body is required");
  return text;
}

export async function readPlanJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new SubscriptionPlanValidationError("Content-Type must be application/json");
  }
  try {
    return JSON.parse(await boundedText(request)) as unknown;
  } catch (error) {
    if (error instanceof SubscriptionPlanValidationError) throw error;
    throw new SubscriptionPlanValidationError("Request body must be valid JSON");
  }
}

export function parseCreatePlanBody(value: unknown): SubscriptionPlanWrite {
  if (!isPlainObject(value)) throw new SubscriptionPlanValidationError("Plan must be an object");
  return value as unknown as SubscriptionPlanWrite;
}

export function parseUpdatePlanBody(value: unknown): {
  expectedUpdatedAt: string;
  patch: SubscriptionPlanPatch;
} {
  if (!isPlainObject(value) || Object.keys(value).length !== 2 ||
      !("expectedUpdatedAt" in value) || !("patch" in value) ||
      typeof value.expectedUpdatedAt !== "string" || !isPlainObject(value.patch)) {
    throw new SubscriptionPlanValidationError("Update requires expectedUpdatedAt and patch");
  }
  return {
    expectedUpdatedAt: value.expectedUpdatedAt,
    patch: value.patch as SubscriptionPlanPatch,
  };
}
