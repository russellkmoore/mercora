import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getOrCreateCustomer } from "@/lib/account/customer";
import { getStoreConfig } from "@/lib/store-config";
import { isBoundedString, isPlainRecord } from "@/lib/public-request-validation";
import type { Address } from "@/lib/types";
import {
  getSubscriptionAcquisitionService,
  SubscriptionNotFoundError,
  SubscriptionProviderConflictError,
} from "@/lib/subscriptions/acquisition-service";
import { SubscriptionAcquisitionConflictError } from "@/lib/subscriptions/repository";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readBoundedUtf8RequestBody } from "@/lib/subscriptions/bounded-request-body";

const MAX_BODY_BYTES = 16_384;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const ALLOWED_ADDRESS_KEYS = new Set([
  "line1", "line2", "city", "region", "postal_code", "country",
  "company", "recipient", "phone", "email", "delivery_instructions",
]);

type SetupIntentBody = {
  planId: string;
  quantity: number;
  shippingAddress?: Address;
  termsVersion: string;
};

function boundedText(value: unknown, max: number, required = true): string | undefined {
  if (value === undefined || value === null || value === "") return required ? undefined : undefined;
  if (typeof value !== "string" || value.length > max) return undefined;
  const normalized = value.trim();
  if (required && !normalized) return undefined;
  return normalized || undefined;
}

function parseAddress(value: unknown): Address | undefined | null {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value) || Object.keys(value).some((key) => !ALLOWED_ADDRESS_KEYS.has(key))) {
    return null;
  }
  const line1 = boundedText(value.line1, 256);
  const city = boundedText(value.city, 128);
  const country = boundedText(value.country, 2)?.toUpperCase();
  if (!line1 || !city || !country || !/^[A-Z]{2}$/.test(country)) return null;

  const optional = (key: string, max: number) => {
    const raw = value[key];
    if (raw === undefined || raw === "") return undefined;
    return boundedText(raw, max, false);
  };
  const fields = {
    line2: optional("line2", 256),
    region: optional("region", 128),
    postal_code: optional("postal_code", 32),
    company: optional("company", 200),
    recipient: optional("recipient", 200),
    phone: optional("phone", 40),
    email: optional("email", 320),
    delivery_instructions: optional("delivery_instructions", 500),
  };
  for (const [key, entry] of Object.entries(fields)) {
    if (value[key] !== undefined && value[key] !== "" && entry === undefined) return null;
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return null;
  return {
    line1,
    city,
    country,
    type: "shipping",
    status: "unverified",
    ...Object.fromEntries(Object.entries(fields).filter(([, entry]) => entry !== undefined)),
  } as Address;
}

async function parseBody(request: Request): Promise<SetupIntentBody | null> {
  const body = await readBoundedUtf8RequestBody(request, MAX_BODY_BYTES);
  if (!body.ok) return null;
  let value: unknown;
  try {
    value = JSON.parse(body.text);
  } catch {
    return null;
  }
  if (!isPlainRecord(value)
    || Object.keys(value).some((key) => !["planId", "quantity", "shippingAddress", "consent"].includes(key))
    || !isBoundedString(value.planId, 128)
    || !Number.isSafeInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > 1000
    || !isPlainRecord(value.consent)
    || Object.keys(value.consent).some((key) => !["termsVersion", "accepted"].includes(key))
    || value.consent.accepted !== true
    || !isBoundedString(value.consent.termsVersion, 100)
    || !/^[A-Za-z0-9._:-]{1,100}$/.test(value.consent.termsVersion)) return null;
  const shippingAddress = parseAddress(value.shippingAddress);
  if (shippingAddress === null) return null;
  return {
    planId: value.planId.trim(),
    quantity: Number(value.quantity),
    shippingAddress,
    termsVersion: value.consent.termsVersion.trim(),
  };
}

function acquisitionEnabled(): boolean {
  const commerce = getStoreConfig().commerce;
  return commerce.features.subscriptionAcquisition
    && commerce.features.subscriptionReconciliation
    && commerce.subscriptionTermsVersion !== undefined;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  }
  if (!acquisitionEnabled()) {
    return NextResponse.json({ error: "Subscription acquisition is unavailable" }, { status: 404 });
  }
  const limited = await enforceRateLimit("PUBLIC_RATE_LIMITER", `subscription-setup:${userId}`);
  if (limited) return limited;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
  }
  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid subscription request" }, { status: 400 });
  const config = getStoreConfig();
  if (body.termsVersion !== config.commerce.subscriptionTermsVersion) {
    return NextResponse.json({ error: "Subscription terms are unavailable" }, { status: 409 });
  }

  try {
    const customer = await getOrCreateCustomer(userId);
    const email = customer.person?.email ?? customer.contacts?.find((entry) => entry.is_primary)?.email;
    if (!email) throw new Error("Authenticated account has no email address");
    const personName = customer.person?.full_name
      ?? [customer.person?.first_name, customer.person?.last_name].filter(Boolean).join(" ");
    const name = personName || customer.company?.display_name || customer.company?.name;
    const service = await getSubscriptionAcquisitionService();
    const result = await service.begin({
      customerId: userId,
      customerEmail: email,
      customerName: name || undefined,
      idempotencyKey,
      planId: body.planId,
      currency: config.commerce.currency,
      quantity: body.quantity,
      shippingAddress: body.shippingAddress,
      termsVersion: body.termsVersion,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SubscriptionAcquisitionConflictError) {
      return NextResponse.json({ error: "Idempotency key conflicts with an existing request" }, { status: 409 });
    }
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json({ error: "Subscription plan is unavailable" }, { status: 404 });
    }
    if (error instanceof SubscriptionProviderConflictError) {
      return NextResponse.json({ error: "Subscription provider response could not be verified" }, { status: 502 });
    }
    recordTelemetry("subscription.acquisition_failed", {
      operation: "create", outcome: "failed", provider: "stripe",
      retryable: true, path: "/api/setup-intent",
    }, error);
    return NextResponse.json({ error: "Subscription checkout is temporarily unavailable" }, { status: 503 });
  }
}
