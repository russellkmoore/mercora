import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import {
  createPaymentCustomerRepository,
  ensureStripeCustomer,
} from "@/lib/payments/customer-binding";

function fakeStripe() {
  const customers: Record<string, { id: string; metadata: { mercora_customer_id: string } }> = {};
  return {
    customers: {
      create: vi.fn(async (params: { metadata: { mercora_customer_id: string } }) => {
        const id = `cus_${Object.keys(customers).length + 1}_${params.metadata.mercora_customer_id}`;
        const customer = { id, metadata: params.metadata };
        customers[id] = customer;
        return customer;
      }),
      retrieve: vi.fn(async (id: string) => {
        const customer = customers[id];
        if (!customer) throw new Error(`No such customer: ${id}`);
        return customer;
      }),
    },
  };
}

async function applyThroughPaymentCustomers() {
  const index = env.TEST_MIGRATIONS.findIndex(
    ({ name }) => name === "0025_add_payment_customers.sql",
  );
  expect(index).toBeGreaterThan(0);
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, index + 1));
}

describe("payment customer binding against real D1", () => {
  it("finds-or-creates end to end: first call creates, second call finds without a second create", async () => {
    await applyThroughPaymentCustomers();
    await env.DB.prepare(`INSERT INTO customers
      (id, type, person, created_at, updated_at)
      VALUES ('cust-binding-shopper', 'person', ?, ?, ?)`)
      .bind(
        JSON.stringify({ email: "shopper@example.test" }),
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ).run();

    const repository = createPaymentCustomerRepository(env.DB);
    const stripe = fakeStripe();

    const firstId = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust-binding-shopper",
    });
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);

    const secondId = await ensureStripeCustomer({
      repository, stripe: stripe as never, customerId: "cust-binding-shopper",
    });

    expect(secondId).toBe(firstId);
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(stripe.customers.retrieve).toHaveBeenCalledWith(firstId);

    const row = await env.DB.prepare(
      "SELECT customer_id, stripe_customer_id, created_at FROM payment_customers WHERE customer_id = ?",
    ).bind("cust-binding-shopper").first<{
      customer_id: string; stripe_customer_id: string; created_at: string;
    }>();
    expect(row?.stripe_customer_id).toBe(firstId);
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("leaves the original binding untouched when a bind for a different Stripe id conflicts", async () => {
    await applyThroughPaymentCustomers();
    await env.DB.prepare(`INSERT INTO customers
      (id, type, person, created_at, updated_at)
      VALUES ('cust-conflict-shopper', 'person', ?, ?, ?)`)
      .bind(
        JSON.stringify({ email: "conflict@example.test" }),
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ).run();

    const repository = createPaymentCustomerRepository(env.DB);

    const firstBind = await repository.bindPaymentCustomer({
      customerId: "cust-conflict-shopper",
      stripeCustomerId: "cus_original_binding",
    });
    expect(firstBind).toBe("created");

    const conflictingBind = await repository.bindPaymentCustomer({
      customerId: "cust-conflict-shopper",
      stripeCustomerId: "cus_different_customer",
    });
    expect(conflictingBind).toBe("conflict");

    const row = await env.DB.prepare(
      "SELECT stripe_customer_id FROM payment_customers WHERE customer_id = ?",
    ).bind("cust-conflict-shopper").first<{ stripe_customer_id: string }>();
    expect(row?.stripe_customer_id).toBe("cus_original_binding");
  });
});
