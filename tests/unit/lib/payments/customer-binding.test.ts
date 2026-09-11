import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getStripeClient: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock("@/lib/stripe", () => ({ getStripeClient: mocks.getStripeClient }));

import {
  ensureStripeCustomer,
  ensureStripeCustomerForShopper,
  findStripeCustomerId,
  PaymentCustomerConflictError,
  type PaymentCustomerBinding,
  type PaymentCustomerRepository,
} from "@/lib/payments/customer-binding";

function fakeRepository(initial?: PaymentCustomerBinding): PaymentCustomerRepository {
  let stored: PaymentCustomerBinding | undefined = initial;
  return {
    findPaymentCustomer: vi.fn(async (customerId: string) =>
      stored && stored.customerId === customerId ? stored : undefined),
    bindPaymentCustomer: vi.fn(async (args: PaymentCustomerBinding) => {
      if (!stored) {
        stored = args;
        return "created" as const;
      }
      return stored.stripeCustomerId === args.stripeCustomerId
        ? "identical" as const
        : "conflict" as const;
    }),
  };
}

function fakeStripe(customers: Record<string, { id: string; metadata: { mercora_customer_id: string }; deleted?: boolean }>) {
  return {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(async (id: string) => {
        const customer = customers[id];
        if (!customer) throw new Error(`No such customer: ${id}`);
        return customer;
      }),
    },
  };
}

describe("ensureStripeCustomer", () => {
  it("returns the stored id and never creates when the existing binding matches Stripe", async () => {
    const repository = fakeRepository({ customerId: "cust_1", stripeCustomerId: "cus_existing" });
    const stripe = fakeStripe({
      cus_existing: { id: "cus_existing", metadata: { mercora_customer_id: "cust_1" } },
    });

    const result = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust_1",
    });

    expect(result).toBe("cus_existing");
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it("throws PaymentCustomerConflictError and binds nothing when Stripe disagrees with the existing binding", async () => {
    const repository = fakeRepository({ customerId: "cust_1", stripeCustomerId: "cus_existing" });
    const stripe = fakeStripe({
      cus_existing: { id: "cus_existing", metadata: { mercora_customer_id: "cust_OTHER" } },
    });

    await expect(ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust_1",
    })).rejects.toThrow(PaymentCustomerConflictError);
    expect(repository.bindPaymentCustomer).not.toHaveBeenCalled();
  });

  it("creates exactly once via customers.create with metadata and a deterministic idempotency key when unbound", async () => {
    const repository = fakeRepository(undefined);
    const stripe = fakeStripe({});
    (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cus_new", metadata: { mercora_customer_id: "cust_1" },
    });

    const result = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust_1",
    });

    expect(result).toBe("cus_new");
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    const [params, options] = (stripe.customers.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params.metadata.mercora_customer_id).toBe("cust_1");
    expect(options.idempotencyKey).toEqual(expect.any(String));
  });

  it("derives a byte-identical idempotency key across two separate calls for the same shopper", async () => {
    async function createOnceAndCaptureKey(resultId: string): Promise<string> {
      const repository = fakeRepository(undefined);
      const stripe = fakeStripe({});
      (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: resultId, metadata: { mercora_customer_id: "cust_retry" },
      });
      await ensureStripeCustomer({ repository, stripe: stripe as never, customerId: "cust_retry" });
      const [, options] = (stripe.customers.create as ReturnType<typeof vi.fn>).mock.calls[0];
      return options.idempotencyKey;
    }

    const keyFromFirstAttempt = await createOnceAndCaptureKey("cus_attempt_one");
    const keyFromRetryAttempt = await createOnceAndCaptureKey("cus_attempt_two");

    expect(keyFromFirstAttempt).toBe(keyFromRetryAttempt);
  });

  it("returns the race winner's id, not the id this call created, when the bind loses", async () => {
    const repository = fakeRepository(undefined);
    const originalBind = repository.bindPaymentCustomer;
    let bindCalls = 0;
    repository.bindPaymentCustomer = vi.fn(async (args: PaymentCustomerBinding) => {
      bindCalls += 1;
      if (bindCalls === 1) {
        // Simulate a concurrent winner landing first.
        (repository.findPaymentCustomer as ReturnType<typeof vi.fn>).mockResolvedValue({
          customerId: "cust_1", stripeCustomerId: "cus_winner",
        });
        return "conflict" as const;
      }
      return originalBind(args);
    });
    const stripe = fakeStripe({
      cus_winner: { id: "cus_winner", metadata: { mercora_customer_id: "cust_1" } },
    });
    (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cus_lost_race", metadata: { mercora_customer_id: "cust_1" },
    });

    const result = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust_1",
    });

    expect(result).toBe("cus_winner");
  });

  it("returns the bound id without error when the bind is identical (benign double-bind)", async () => {
    const repository = fakeRepository(undefined);
    repository.bindPaymentCustomer = vi.fn(async () => "identical" as const);
    (repository.findPaymentCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const stripe = fakeStripe({});
    (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cus_dup", metadata: { mercora_customer_id: "cust_1" },
    });

    const result = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust_1",
    });

    expect(result).toBe("cus_dup");
  });
});

describe("findStripeCustomerId", () => {
  beforeEach(() => {
    mocks.getCloudflareContext.mockReset();
    mocks.getStripeClient.mockReset();
  });

  it("returns undefined, not a thrown error, for a shopper with no binding", async () => {
    const DB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ first: vi.fn(async () => null) })),
      })),
    };
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB } });

    await expect(findStripeCustomerId("cust_no_binding")).resolves.toBeUndefined();
  });
});

describe("module surface", () => {
  it("exports the three request-scoped entry points as functions", () => {
    expect(typeof ensureStripeCustomerForShopper).toBe("function");
    expect(typeof findStripeCustomerId).toBe("function");
    expect(typeof ensureStripeCustomer).toBe("function");
  });
});
