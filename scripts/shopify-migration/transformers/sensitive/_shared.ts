import { providerFingerprint } from "../../lib/ids.js";
import { SHOPIFY_PROVIDER } from "../_shared.js";

export const MAX_SENSITIVE_RECORDS = 100_000;
export const MAX_ADDRESSES = 25;
export const MAX_ORDER_ITEMS = 500;

export interface SensitiveTransformResult<TRecord> {
  records: TRecord[];
  idMap: Map<string, string>;
  skipped: Array<{ sourceFingerprint: string | null; reason: string }>;
  warnings: string[];
}

const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SAFE_TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,255}$/;

export function assertBatchSize(length: number): void {
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_SENSITIVE_RECORDS) {
    throw new RangeError(`Sensitive transform batches may contain at most ${MAX_SENSITIVE_RECORDS} records`);
  }
}

export function sourceId(value: string | number): string {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 512 || FORBIDDEN_CONTROL.test(normalized)) {
    throw new TypeError("Provider source ID is invalid");
  }
  return normalized;
}

export function boundedText(
  value: unknown,
  maxLength: number,
  options: { required?: boolean; multiline?: boolean } = {},
): string | null {
  if (value === undefined || value === null) {
    if (options.required) throw new TypeError("Required text is missing");
    return null;
  }
  if (typeof value !== "string" || FORBIDDEN_CONTROL.test(value)) {
    throw new TypeError("Text contains an invalid value");
  }
  const normalized = options.multiline
    ? value.replace(/\r\n?/g, "\n").trim()
    : value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    if (options.required) throw new TypeError("Required text is empty");
    return null;
  }
  if (normalized.length > maxLength) throw new RangeError(`Text exceeds ${maxLength} characters`);
  return normalized;
}

export function normalizedEmail(value: unknown, required = false): string | null {
  const email = boundedText(value, 254, { required })?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new TypeError("Email address is invalid");
  }
  return email;
}

export function safeTargetId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && SAFE_TARGET_ID.test(normalized) ? normalized : null;
}

export function resolvedProviderId(
  mappings: ReadonlyMap<string, string> | undefined,
  entity: string,
  providerSourceId: string | number,
): string | null {
  return safeTargetId(mappings?.get(
    providerFingerprint(SHOPIFY_PROVIDER, entity, providerSourceId),
  ));
}

export function emailFingerprint(email: string): string {
  return providerFingerprint(SHOPIFY_PROVIDER, "customer_email", email.toLowerCase());
}

export function boundedTags(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string" || value.length > 10_000) throw new TypeError("Tags are invalid");
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(",")) {
    const tag = boundedText(raw, 100);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("en-US");
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
    if (tags.length > 50) throw new RangeError("Customer has too many tags");
  }
  return tags;
}
