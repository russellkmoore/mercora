import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";

export const MAX_ACCOUNT_BODY_BYTES = 8_192;
export const MAX_SAVED_ADDRESSES = 25;
const MAX_ADDRESS_FIELD = 200;
const MAX_LABEL = 80;

type AddressInput = Record<string, unknown>;

function boundedText(value: unknown, field: string, required = false, max = MAX_ADDRESS_FIELD) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) {
    throw new Error(`${field} is invalid`);
  }
  return normalized || undefined;
}

export function parseAddressInput(input: AddressInput): Omit<MACHCustomerAddress, "id"> {
  const country = boundedText(input.country, "country", true)?.toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    throw new Error("country must be a two-letter code");
  }
  const type = input.type === "billing" ? "billing" : "shipping";
  return {
    type,
    label: boundedText(input.label, "label", false, MAX_LABEL),
    is_default: input.is_default === true,
    address: {
      line1: boundedText(input.line1, "line1", true)!,
      line2: boundedText(input.line2, "line2"),
      city: boundedText(input.city, "city", true)!,
      region: boundedText(input.region, "region"),
      postal_code: boundedText(input.postal_code, "postal_code", false, 32),
      country,
    },
  };
}

export function assertBoundedRequest(request: Request): void {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_ACCOUNT_BODY_BYTES) {
    throw new Error("Request body is too large");
  }
}

export function parseProfileInput(input: Record<string, unknown>) {
  return {
    firstName: boundedText(input.first_name, "first_name", false, 100) ?? "",
    lastName: boundedText(input.last_name, "last_name", false, 100) ?? "",
  };
}
