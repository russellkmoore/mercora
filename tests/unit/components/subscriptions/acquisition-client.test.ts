import { describe, expect, it, vi } from "vitest";
import type { SetupIntent, StripeElements } from "@stripe/stripe-js";
import {
  attemptFactsKey,
  confirmSetupAndFinalize,
  createSubscriptionSetupAttempt,
  fetchSavedAddressesForPlan,
  fetchSubscriptionPlans,
  shippingAddressFromSaved,
  type FetchLike,
} from "@/components/subscriptions/acquisition-client";

const plan = {
  id: "plan_one",
  product: { id: "prod_one", label: "Tea" },
  variant: { id: "var_one", label: "Large" },
  price: { amount: 12.5, currency: "USD", precision: 2 },
  cadence: { unit: "month", count: 1 },
  shippingRequired: true,
};

describe("subscription acquisition client", () => {
  it("requests only the selected variant and rejects cross-variant plans", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      plans: [plan, { ...plan, id: "wrong", variant: { id: "var_other", label: "Other" } }],
    }), { status: 200 })) as unknown as FetchLike;
    await expect(fetchSubscriptionPlans(fetcher, "var_one")).resolves.toEqual([plan]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/subscription-plans?variantId=var_one&limit=100&offset=0",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("flattens only the saved physical address authority", () => {
    expect(shippingAddressFromSaved({
      id: "addr_one",
      label: "Home",
      address: {
        line1: { en: "1 Main" }, line2: { en: "Suite 2" }, city: { en: "Denver" }, region: "CO", postal_code: "80202",
        country: "US", type: "shipping", status: "verified",
        extensions: { private: "not-forwarded" },
      },
    })).toEqual({
      line1: "1 Main", line2: "Suite 2", city: "Denver", region: "CO", postal_code: "80202", country: "US",
    });
  });

  it("loads saved addresses only for authenticated physical-plan orchestration", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      addresses: [{ id: "addr_one", address: { line1: "1 Main", city: "Denver", country: "US" } }],
    }), { status: 200 })) as unknown as FetchLike;
    await expect(fetchSavedAddressesForPlan(fetcher, { shippingRequired: false })).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(fetchSavedAddressesForPlan(fetcher, { shippingRequired: true })).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith("/api/account/addresses", expect.objectContaining({
      method: "GET", cache: "no-store",
    }));
  });

  it("sends the exact physical SetupIntent body, consent, and stable key", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "seti_secret",
    }), { status: 201 })) as unknown as FetchLike;
    await createSubscriptionSetupAttempt(fetcher, {
      planId: "plan_one",
      quantity: 2,
      shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
      termsVersion: "terms-1",
      idempotencyKey: "attempt-one",
    });
    const [, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "attempt-one",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      planId: "plan_one",
      quantity: 2,
      shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
      consent: { termsVersion: "terms-1", accepted: true },
    });
  });

  it("omits shipping entirely for a digital plan attempt", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "secret",
    }), { status: 201 })) as unknown as FetchLike;
    await createSubscriptionSetupAttempt(fetcher, {
      planId: "plan_digital", quantity: 1, termsVersion: "terms-1", idempotencyKey: "attempt-one",
    });
    const body = JSON.parse(String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body).not.toHaveProperty("shippingAddress");
  });

  it("confirms SetupIntent before finalizing and sends only its verified id", async () => {
    const order: string[] = [];
    const setupIntent = { id: "seti_one", status: "succeeded" } as SetupIntent;
    const stripe = {
      confirmSetup: vi.fn(async () => {
        order.push("confirm");
        return { setupIntent };
      }),
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      order.push("finalize");
      expect(JSON.parse(String(init?.body))).toEqual({ setupIntentId: "seti_one" });
      return new Response(JSON.stringify({
        subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
      }), {
        status: 202,
      });
    }) as unknown as FetchLike;
    await confirmSetupAndFinalize({
      stripe: stripe as never,
      elements: {} as StripeElements,
      fetcher,
      returnUrl: "https://store.example/product/tea",
    });
    expect(order).toEqual(["confirm", "finalize"]);
    expect(stripe.confirmSetup).toHaveBeenCalledWith(expect.objectContaining({
      redirect: "if_required",
      confirmParams: { return_url: "https://store.example/product/tea" },
    }));
  });

  it("stops before finalization when Stripe confirmation fails", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    await expect(confirmSetupAndFinalize({
      stripe: { confirmSetup: vi.fn(async () => ({ error: { message: "Card declined" } })) } as never,
      elements: {} as StripeElements,
      fetcher,
      returnUrl: "https://store.example/product/tea",
    })).rejects.toThrow("Card declined");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed or non-202 finalization responses", async () => {
    const setupIntent = { id: "seti_one", status: "succeeded" } as SetupIntent;
    const stripe = { confirmSetup: vi.fn(async () => ({ setupIntent })) };
    for (const response of [
      new Response(JSON.stringify({ subscription: null }), { status: 202 }),
      new Response(JSON.stringify({
        subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
      }), { status: 200 }),
    ]) {
      const fetcher = vi.fn(async () => response.clone()) as unknown as FetchLike;
      await expect(confirmSetupAndFinalize({
        stripe: stripe as never,
        elements: {} as StripeElements,
        fetcher,
        returnUrl: "https://store.example/product/tea",
      })).rejects.toThrow("finalization");
    }
  });

  it("changes attempt identity whenever customer-controlled facts change", () => {
    const base = {
      planId: "plan_one",
      quantity: 1,
      shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
      termsVersion: "terms-1",
    };
    expect(attemptFactsKey(base)).toBe(attemptFactsKey({ ...base }));
    expect(attemptFactsKey(base)).not.toBe(attemptFactsKey({ ...base, quantity: 2 }));
    expect(attemptFactsKey(base)).not.toBe(attemptFactsKey({
      ...base,
      // Same saved-address id is intentionally absent from the facts; the
      // edited canonical snapshot must create a fresh provider attempt.
      shippingAddress: { ...base.shippingAddress, line1: "2 Changed" },
    }));
  });
});
