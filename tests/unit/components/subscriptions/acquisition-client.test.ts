import { describe, expect, it, vi } from "vitest";
import type { SetupIntent, StripeElements } from "@stripe/stripe-js";
import {
  attemptFactsKey,
  completeStripeSetupRedirect,
  confirmSubscriptionSetup,
  createOwnerBoundSubscriptionSetupAttempt,
  createSubscriptionSetupAttempt,
  fetchSavedAddressesForPlan,
  fetchSubscriptionPlans,
  finalizeSubscriptionSetup,
  parseStripeSetupRedirect,
  recurringTotal,
  shippingAddressFromSaved,
  type FetchLike,
  type PublicSubscriptionPlan,
} from "@/components/subscriptions/acquisition-client";

const plan: PublicSubscriptionPlan = {
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
      total: 2,
      meta: { limit: 100, offset: 0 },
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
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "seti_one_secret_value",
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
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "seti_one_secret_value",
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
    const confirmed = await confirmSubscriptionSetup({
      stripe: stripe as never,
      elements: {} as StripeElements,
      returnUrl: "https://store.example/product/tea",
    });
    await finalizeSubscriptionSetup(fetcher, confirmed.id);
    expect(order).toEqual(["confirm", "finalize"]);
    expect(stripe.confirmSetup).toHaveBeenCalledWith(expect.objectContaining({
      redirect: "if_required",
      confirmParams: { return_url: "https://store.example/product/tea" },
    }));
  });

  it("stops before finalization when Stripe confirmation fails", async () => {
    await expect(confirmSubscriptionSetup({
      stripe: { confirmSetup: vi.fn(async () => ({ error: { message: "Card declined" } })) } as never,
      elements: {} as StripeElements,
      returnUrl: "https://store.example/product/tea",
    })).rejects.toThrow("Card declined");
  });

  it("retries a confirmed SetupIntent finalization without calling Stripe again", async () => {
    const setupIntent = { id: "seti_retry", status: "succeeded" } as SetupIntent;
    const stripe = { confirmSetup: vi.fn(async () => ({ setupIntent })) };
    const confirmed = await confirmSubscriptionSetup({
      stripe: stripe as never,
      elements: {} as StripeElements,
      returnUrl: "https://store.example/product/tea",
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporarily unavailable" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
      }), { status: 202 })) as unknown as FetchLike;

    await expect(finalizeSubscriptionSetup(fetcher, confirmed.id)).rejects.toThrow("finalization");
    await expect(finalizeSubscriptionSetup(fetcher, confirmed.id)).resolves.toMatchObject({ id: "acq_one" });

    expect(stripe.confirmSetup).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of (fetcher as ReturnType<typeof vi.fn>).mock.calls) {
      expect(JSON.parse(String(call[1]?.body))).toEqual({ setupIntentId: "seti_retry" });
    }
  });

  it("rejects malformed or non-202 finalization responses", async () => {
    for (const response of [
      new Response(JSON.stringify({ subscription: null }), { status: 202 }),
      new Response(JSON.stringify({
        subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
      }), { status: 200 }),
    ]) {
      const fetcher = vi.fn(async () => response.clone()) as unknown as FetchLike;
      await expect(finalizeSubscriptionSetup(fetcher, "seti_one")).rejects.toThrow("finalization");
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

  it("computes exact quantity totals and fails closed on invalid or overflowing amounts", () => {
    expect(recurringTotal(plan, 2)).toMatchObject({ amount: 25 });
    expect(recurringTotal(plan, 2)?.formatted).toContain("25.00");
    expect(recurringTotal({ ...plan, price: { ...plan.price, amount: 12.501 } }, 2)).toBeNull();
    expect(recurringTotal({
      ...plan,
      price: { amount: Number.MAX_SAFE_INTEGER, currency: "USD", precision: 0 },
    }, 2)).toBeNull();
    expect(recurringTotal(plan, 1001)).toBeNull();
  });

  it("strictly parses and scrubs successful, failed, and malformed Stripe redirects", () => {
    const success = parseStripeSetupRedirect(
      "https://store.example/product/tea?campaign=fall&setup_intent=seti_one&setup_intent_client_secret=never-trust-this&redirect_status=succeeded#buy",
      "https://store.example",
    );
    expect(success).toEqual({
      kind: "success",
      setupIntentId: "seti_one",
      cleanUrl: "/product/tea?campaign=fall#buy",
    });
    expect(JSON.stringify(success)).not.toContain("never-trust-this");
    expect(parseStripeSetupRedirect(
      "https://store.example/product/tea?setup_intent=seti_one&redirect_status=failed",
      "https://store.example",
    )).toMatchObject({ kind: "failure", cleanUrl: "/product/tea" });
    expect(parseStripeSetupRedirect(
      "https://store.example/product/tea?setup_intent=seti_one&setup_intent=seti_two&redirect_status=succeeded",
      "https://store.example",
    )).toMatchObject({ kind: "malformed", cleanUrl: "/product/tea" });
    expect(parseStripeSetupRedirect(
      "https://attacker.example/product/tea?setup_intent=seti_one&redirect_status=succeeded",
      "https://store.example",
    )).toEqual({ kind: "malformed" });
  });

  it("retains a scrubbed redirect through anonymous state and finalizes only after sign-in", async () => {
    const redirect = parseStripeSetupRedirect(
      "https://store.example/product/tea?setup_intent=seti_one&setup_intent_client_secret=discarded&redirect_status=succeeded",
      "https://store.example",
    );
    let currentOwner: string | null = null;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
    }), { status: 202 })) as unknown as FetchLike;
    await expect(completeStripeSetupRedirect({
      fetcher, redirect, ownerId: null, currentOwner: () => currentOwner,
    })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    currentOwner = "user_A";
    await expect(completeStripeSetupRedirect({
      fetcher, redirect, ownerId: currentOwner, currentOwner: () => currentOwner,
    })).resolves.toMatchObject({ id: "acq_one" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shows safe redirect failures and rejects malformed returns without finalizing", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const currentOwner = () => "user_A";
    await expect(completeStripeSetupRedirect({
      fetcher,
      redirect: { kind: "failure", cleanUrl: "/product/tea" },
      ownerId: "user_A",
      currentOwner,
    })).rejects.toThrow("not completed");
    await expect(completeStripeSetupRedirect({
      fetcher,
      redirect: { kind: "malformed", cleanUrl: "/product/tea" },
      ownerId: "user_A",
      currentOwner,
    })).rejects.toThrow("invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("can retry the retained scrubbed redirect after a transient finalization failure", async () => {
    const redirect = parseStripeSetupRedirect(
      "https://store.example/product/tea?setup_intent=seti_one&redirect_status=succeeded",
      "https://store.example",
    );
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "temporarily_unavailable" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        subscription: { id: "acq_one", planId: "plan_one", quantity: 1, status: "provider_created" },
      }), { status: 202 })) as unknown as FetchLike;
    const args = {
      fetcher, redirect, ownerId: "user_A", currentOwner: () => "user_A",
    };
    await expect(completeStripeSetupRedirect(args)).rejects.toThrow("temporarily unavailable");
    await expect(completeStripeSetupRedirect(args)).resolves.toMatchObject({ id: "acq_one" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("discards a late setup response after a user switch or sign-out", async () => {
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    const fetcher = vi.fn(async () => response) as unknown as FetchLike;
    let currentOwner: string | null = "user_A";
    const pending = createOwnerBoundSubscriptionSetupAttempt(fetcher, {
      planId: "plan_one", quantity: 1, termsVersion: "terms-1", idempotencyKey: "attempt-one",
    }, "user_A", () => currentOwner);
    currentOwner = "user_B";
    resolveResponse(new Response(JSON.stringify({
      acquisitionId: "acq_one", setupIntentId: "seti_one", clientSecret: "seti_one_secret_value",
    }), { status: 201 }));
    await expect(pending).resolves.toBeNull();

    currentOwner = null;
    await expect(createOwnerBoundSubscriptionSetupAttempt(fetcher, {
      planId: "plan_one", quantity: 1, termsVersion: "terms-1", idempotencyKey: "attempt-two",
    }, "user_A", () => currentOwner)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds declared and actual response bytes and cancels invalid UTF-8 streams", async () => {
    const declared = vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "content-length": "131073" },
    })) as unknown as FetchLike;
    await expect(fetchSubscriptionPlans(declared, "var_one")).rejects.toThrow("too large");

    const actual = vi.fn(async () => new Response(JSON.stringify({ value: "é".repeat(70_000) }), {
      status: 200,
    })) as unknown as FetchLike;
    await expect(fetchSubscriptionPlans(actual, "var_one")).rejects.toThrow("too large");

    const canceled = vi.fn();
    const invalidUtf8 = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(Uint8Array.from([0xff])); },
      cancel: canceled,
    }), { status: 200 })) as unknown as FetchLike;
    await expect(fetchSubscriptionPlans(invalidUtf8, "var_one")).rejects.toThrow("invalid");
    expect(canceled).toHaveBeenCalledOnce();
  });
});
