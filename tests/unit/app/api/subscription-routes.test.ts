import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateCustomer: vi.fn(),
  getStoreConfig: vi.fn(),
  begin: vi.fn(),
  finalize: vi.fn(),
  list: vi.fn(),
  act: vi.fn(),
  rateLimit: vi.fn(),
  telemetry: vi.fn(),
  getService: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/account/customer", () => ({ getOrCreateCustomer: mocks.getOrCreateCustomer }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/subscriptions/acquisition-service", () => ({
  getSubscriptionAcquisitionService: mocks.getService,
  SubscriptionNotFoundError: class SubscriptionNotFoundError extends Error {},
  SubscriptionProviderConflictError: class SubscriptionProviderConflictError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.rateLimit }));
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: mocks.telemetry }));

import { POST as setup } from "@/app/api/setup-intent/route";
import { GET as list, POST as finalize } from "@/app/api/subscriptions/route";
import { POST as pause } from "@/app/api/subscriptions/[id]/pause/route";
import { POST as resume } from "@/app/api/subscriptions/[id]/resume/route";
import { POST as cancel } from "@/app/api/subscriptions/[id]/cancel/route";
import { SubscriptionProviderConflictError } from "@/lib/subscriptions/acquisition-service";

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://store.example${path}`, {
    method: "POST",
    headers: { origin: "https://store.example", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("subscription customer routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_one" });
    mocks.rateLimit.mockResolvedValue(null);
    mocks.getService.mockResolvedValue({
      begin: mocks.begin, finalize: mocks.finalize, list: mocks.list, act: mocks.act,
    });
    mocks.getStoreConfig.mockReturnValue({
      commerce: {
        currency: "USD",
        subscriptionTermsVersion: "terms-1",
        features: { subscriptionAcquisition: true, subscriptionReconciliation: true },
      },
    });
    mocks.getOrCreateCustomer.mockResolvedValue({
      id: "user_one",
      type: "person",
      person: { email: "trusted@example.test", full_name: "Trusted Name" },
    });
    mocks.begin.mockResolvedValue({
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "secret",
    });
    mocks.finalize.mockResolvedValue({ id: "acq_one", status: "provider_created" });
    mocks.act.mockResolvedValue({ subscription: { id: "subscription_acq_one" }, reconciliationPending: true });
  });

  it("rejects unauthenticated and disabled acquisition before service construction", async () => {
    mocks.auth.mockResolvedValueOnce({ userId: null });
    const unauthorized = await setup(request("/api/setup-intent", {}, { "idempotency-key": "checkout-key-001" }));
    expect(unauthorized.status).toBe(401);
    mocks.getStoreConfig.mockReturnValueOnce({
      commerce: {
        currency: "USD", subscriptionTermsVersion: "terms-1",
        features: { subscriptionAcquisition: false, subscriptionReconciliation: true },
      },
    });
    const disabled = await setup(request("/api/setup-intent", {}, { "idempotency-key": "checkout-key-001" }));
    expect(disabled.status).toBe(404);
    expect(mocks.getService).not.toHaveBeenCalled();
  });

  it("rate-limits before parsing or provider work", async () => {
    mocks.rateLimit.mockResolvedValueOnce(new Response("limited", { status: 429 }));
    const response = await finalize(new NextRequest("https://store.example/api/subscriptions", {
      method: "POST", headers: { origin: "https://store.example" }, body: "not-json",
    }));
    expect(response.status).toBe(429);
    expect(mocks.getService).not.toHaveBeenCalled();
  });

  it("creates an acquisition from authenticated identity and configured terms", async () => {
    const response = await setup(request("/api/setup-intent", {
      planId: "plan_one",
      quantity: 1,
      consent: { termsVersion: "terms-1", accepted: true },
    }, { "idempotency-key": "checkout-key-001" }));
    expect(response.status).toBe(201);
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "user_one",
      customerEmail: "trusted@example.test",
      customerName: "Trusted Name",
      termsVersion: "terms-1",
    }));
  });

  it("rejects caller-selected stale terms before provider work", async () => {
    const response = await setup(request("/api/setup-intent", {
      planId: "plan_one",
      quantity: 1,
      consent: { termsVersion: "terms-old", accepted: true },
    }, { "idempotency-key": "checkout-key-001" }));
    expect(response.status).toBe(409);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("owner-scopes finalization and requires same-origin", async () => {
    const denied = await finalize(request("/api/subscriptions", { setupIntentId: "seti_one" }, {
      origin: "https://attacker.example",
    }));
    expect(denied.status).toBe(403);
    const accepted = await finalize(request("/api/subscriptions", { setupIntentId: "seti_one" }));
    expect(accepted.status).toBe(202);
    expect(mocks.finalize).toHaveBeenCalledWith("user_one", "seti_one");
  });

  it("bounds empty action bodies and validates the local subscription id", async () => {
    const invalidId = await pause(request("/api/subscriptions/not-a-sub/pause", {}), {
      params: Promise.resolve({ id: "not-a-sub" }),
    });
    expect(invalidId.status).toBe(404);
    const invalidBody = await pause(request("/api/subscriptions/subscription_acq_one/pause", { behavior: "keep" }), {
      params: Promise.resolve({ id: "subscription_acq_one" }),
    });
    expect(invalidBody.status).toBe(400);
    const accepted = await pause(request("/api/subscriptions/subscription_acq_one/pause", {}), {
      params: Promise.resolve({ id: "subscription_acq_one" }),
    });
    expect(accepted.status).toBe(202);
    expect(mocks.act).toHaveBeenCalledWith("user_one", "subscription_acq_one", { type: "pause" });
  });

  it("projects owner lists and masks list failures", async () => {
    mocks.list.mockResolvedValueOnce([{ id: "subscription_acq_one", status: "active" }]);
    const response = await list();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscriptions: [{ id: "subscription_acq_one", status: "active" }] });
    mocks.list.mockRejectedValueOnce(new Error("database details"));
    const failed = await list();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "Subscriptions are temporarily unavailable" });
  });

  it("does not construct list dependencies when reconciliation is disabled", async () => {
    mocks.getStoreConfig.mockReturnValueOnce({
      commerce: {
        currency: "USD", subscriptionTermsVersion: "terms-1",
        features: { subscriptionAcquisition: false, subscriptionReconciliation: false },
      },
    });
    const response = await list();
    expect(response.status).toBe(404);
    expect(mocks.getService).not.toHaveBeenCalled();
  });

  it("accepts bounded resume and both cancellation modes", async () => {
    const resumed = await resume(request("/api/subscriptions/subscription_acq_one/resume", {}), {
      params: Promise.resolve({ id: "subscription_acq_one" }),
    });
    expect(resumed.status).toBe(202);
    const period = await cancel(request("/api/subscriptions/subscription_acq_one/cancel", { mode: "period_end" }), {
      params: Promise.resolve({ id: "subscription_acq_one" }),
    });
    const immediate = await cancel(request("/api/subscriptions/subscription_acq_one/cancel", { mode: "immediate" }), {
      params: Promise.resolve({ id: "subscription_acq_one" }),
    });
    expect(period.status).toBe(202);
    expect(immediate.status).toBe(202);
    expect(mocks.act).toHaveBeenCalledWith("user_one", "subscription_acq_one", { type: "resume" });
    expect(mocks.act).toHaveBeenCalledWith("user_one", "subscription_acq_one", {
      type: "cancel", mode: "period_end",
    });
    expect(mocks.act).toHaveBeenCalledWith("user_one", "subscription_acq_one", {
      type: "cancel", mode: "immediate",
    });
  });

  it("masks unknown provider failures", async () => {
    mocks.finalize.mockRejectedValueOnce(new Error("raw provider secret"));
    const response = await finalize(request("/api/subscriptions", { setupIntentId: "seti_one" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Subscription checkout is temporarily unavailable" });
  });

  it("maps verified provider conflicts without exposing raw details", async () => {
    mocks.finalize.mockRejectedValueOnce(new SubscriptionProviderConflictError("secret mismatch"));
    const response = await finalize(request("/api/subscriptions", { setupIntentId: "seti_one" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Subscription provider response could not be verified",
    });
  });
});
