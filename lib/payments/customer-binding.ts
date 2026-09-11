/**
 * Payment customer binding — the durable customer <-> Stripe-customer link
 * checkout saved-card storage stands on (Phase 17, PAY-01).
 *
 * Mirrors `establishProviderCustomer`'s idempotent find-or-create /
 * conflict-reconciliation algorithm (lib/subscriptions/acquisition-service.ts)
 * against the independent `payment_customers` table — copied, not imported,
 * per D-02/D-03 in .planning/phases/17-saved-payment-methods/17-CONTEXT.md.
 * Plans 17-02 and 17-04 import only the exports below; nothing else in this
 * module is public API.
 *
 * Never write a card number, a Stripe secret key, or a client secret into a
 * log line or an error message from this module.
 */

import type Stripe from "stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getStripeClient } from "@/lib/stripe";

export interface PaymentCustomerBinding {
  customerId: string;
  stripeCustomerId: string;
}

export class PaymentCustomerConflictError extends Error {}

/** Deterministic idempotency key, mirroring `stableId` in
 * lib/subscriptions/acquisition-service.ts — copied locally per D-03, not
 * imported. Joins parts on a NUL character (U+0000), matching the real
 * source; 17-RESEARCH.md transcribed this as space-joined, which is wrong. */
async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(parts.join("\u0000"));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 48)}`;
}

/** Drop (never throw on) an over-long optional field before sending it to
 * Stripe, matching the subscriptions adapter's bounds. */
function boundedOptional(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined || value.length < 1 || value.length > maxLength) return undefined;
  return value;
}

/** Verify a Stripe customer belongs to the expected Mercora shopper. Throws
 * PaymentCustomerConflictError on a deleted customer or mismatched
 * ownership metadata; never returns for those cases. */
function verifyOwnership(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  customerId: string,
): void {
  if ("deleted" in customer && customer.deleted) {
    throw new PaymentCustomerConflictError("Stripe customer is deleted");
  }
  const metadata = (customer as Stripe.Customer).metadata;
  if (metadata?.mercora_customer_id !== customerId) {
    throw new PaymentCustomerConflictError(
      "Stripe customer metadata does not match the Mercora customer",
    );
  }
}

export type PaymentCustomerRepository = ReturnType<typeof createPaymentCustomerRepository>;

export function createPaymentCustomerRepository(database: D1Database) {
  const repository = {
    async findPaymentCustomer(customerId: string): Promise<PaymentCustomerBinding | undefined> {
      return (await database.prepare(`SELECT customer_id AS customerId,
        stripe_customer_id AS stripeCustomerId
        FROM payment_customers WHERE customer_id = ? LIMIT 1`)
        .bind(customerId).first<PaymentCustomerBinding>()) ?? undefined;
    },

    async bindPaymentCustomer(
      args: PaymentCustomerBinding,
    ): Promise<"created" | "identical" | "conflict"> {
      const result = await database.prepare(`INSERT OR IGNORE INTO payment_customers
        (customer_id, stripe_customer_id) VALUES (?, ?)`)
        .bind(args.customerId, args.stripeCustomerId).run();
      if ((result.meta.changes ?? 0) > 0) return "created";
      const winner = await repository.findPaymentCustomer(args.customerId);
      return winner?.stripeCustomerId === args.stripeCustomerId ? "identical" : "conflict";
    },
  };
  return repository;
}

/** Injectable core: find-or-create a Stripe customer for a Mercora shopper,
 * reconciling a concurrent bind race against the winning row. Throws
 * PaymentCustomerConflictError if Stripe's own record disagrees with the
 * stored binding at any point. */
export async function ensureStripeCustomer(args: {
  repository: PaymentCustomerRepository;
  stripe: Stripe;
  customerId: string;
  email?: string;
  name?: string;
}): Promise<string> {
  const { repository, stripe, customerId } = args;

  const existing = await repository.findPaymentCustomer(customerId);
  if (existing) {
    const customer = await stripe.customers.retrieve(existing.stripeCustomerId);
    verifyOwnership(customer, customerId);
    return existing.stripeCustomerId;
  }

  const email = boundedOptional(args.email, 320);
  const name = boundedOptional(args.name, 200);
  const idempotencyKey = await stableId("payment-customer", customerId);
  const created = await stripe.customers.create({
    metadata: { mercora_customer_id: customerId },
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
  }, { idempotencyKey });

  const result = await repository.bindPaymentCustomer({
    customerId,
    stripeCustomerId: created.id,
  });
  if (result === "conflict") {
    const winner = await repository.findPaymentCustomer(customerId);
    if (!winner) {
      throw new PaymentCustomerConflictError("Payment customer mapping did not converge");
    }
    const winnerCustomer = await stripe.customers.retrieve(winner.stripeCustomerId);
    verifyOwnership(winnerCustomer, customerId);
    return winner.stripeCustomerId;
  }
  return created.id;
}

/** Request-scoped default wiring: resolves D1 and the server Stripe client
 * itself. The only entry point plan 17-02 calls. */
export async function ensureStripeCustomerForShopper(args: {
  customerId: string;
  email?: string;
  name?: string;
}): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const repository = createPaymentCustomerRepository(env.DB);
  const stripe = getStripeClient();
  return ensureStripeCustomer({ repository, stripe, ...args });
}

/** Request-scoped read-only lookup. The only entry point plan 17-04 calls. */
export async function findStripeCustomerId(customerId: string): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const repository = createPaymentCustomerRepository(env.DB);
  const binding = await repository.findPaymentCustomer(customerId);
  return binding?.stripeCustomerId;
}
