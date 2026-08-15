import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import {
  createSubscriptionPlanService,
  SubscriptionPlanConflictError,
  SubscriptionPlanValidationError,
} from "@/lib/subscriptions/plan-service";
import {
  createLazyStripePlanPriceVerifier,
  SubscriptionPlanPriceMismatchError,
  SubscriptionPlanPriceUnavailableError,
} from "@/lib/subscriptions/plan-price-adapter";

const ACCEPT_PRICE = { verify: async () => undefined };

const PLAN = {
  id: "plan_monthly",
  productId: "prod_tea",
  variantId: "var_black",
  currency: "USD",
  unitAmountMinor: 1299,
  stripePriceId: "price_monthly",
  cadence: { unit: "month" as const, count: 1 },
  active: true,
};

async function seedCatalog() {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO products (id, name, status, fulfillment_type)
      VALUES ('prod_tea', ?, 'active', 'physical')`)
      .bind(JSON.stringify({ "en-US": "Black Tea", fr: "Thé noir" })),
    env.DB.prepare(`INSERT INTO products (id, name, status, fulfillment_type)
      VALUES ('prod_other', 'Other Tea', 'active', 'physical')`),
    env.DB.prepare(`INSERT INTO product_variants
      (id, product_id, sku, status, option_values, price, shipping_required)
      VALUES ('var_black', 'prod_tea', 'TEA-BLACK', 'active', ?, ?, 1)`)
      .bind(
        JSON.stringify([{ option_id: "size", value: "20 sachets" }]),
        JSON.stringify({ amount: 1500, currency: "USD" }),
      ),
    env.DB.prepare(`INSERT INTO product_variants
      (id, product_id, sku, status, option_values, price, shipping_required)
      VALUES ('var_green', 'prod_tea', 'TEA-GREEN', 'active', '[]', ?, 0)`)
      .bind(JSON.stringify({ amount: 1400, currency: "USD" })),
    env.DB.prepare(`INSERT INTO product_variants
      (id, product_id, sku, status, option_values, price, shipping_required)
      VALUES ('var_other', 'prod_other', 'OTHER', 'active', '[]', ?, 1)`)
      .bind(JSON.stringify({ amount: 1000, currency: "EUR" })),
  ]);
}

describe("subscription plan management on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM subscription_events"),
      env.DB.prepare("DELETE FROM subscription_invoice_orders"),
      env.DB.prepare("DELETE FROM customer_subscriptions"),
      env.DB.prepare("DELETE FROM subscription_acquisitions"),
      env.DB.prepare("DELETE FROM subscription_provider_customers"),
      env.DB.prepare("DELETE FROM subscription_plans"),
      env.DB.prepare("DELETE FROM product_variants WHERE product_id IN ('prod_tea', 'prod_other')"),
      env.DB.prepare("DELETE FROM products WHERE id IN ('prod_tea', 'prod_other')"),
    ]);
    await seedCatalog();
  });

  it("creates a validated binding and exposes a narrow exact public projection", async () => {
    const service = createSubscriptionPlanService(env.DB, {
      now: () => new Date("2026-08-15T01:02:03.004Z"),
      priceVerifier: ACCEPT_PRICE,
    });
    const created = await service.create(PLAN);
    expect(created).toMatchObject({
      id: "plan_monthly",
      product: { id: "prod_tea", label: "Black Tea" },
      variant: { id: "var_black", label: "20 sachets" },
      price: { amount: 12.99, currency: "USD", precision: 2 },
      unitAmountMinor: 1299,
      stripePriceId: "price_monthly",
      active: true,
      createdAt: "2026-08-15T01:02:03.004Z",
      updatedAt: "2026-08-15T01:02:03.004Z",
      shippingRequired: true,
    });

    const page = await service.listPublic({ limit: 20, offset: 0 });
    expect(page.total).toBe(1);
    expect(page.plans).toEqual([{
      id: "plan_monthly",
      product: { id: "prod_tea", label: "Black Tea" },
      variant: { id: "var_black", label: "20 sachets" },
      price: { amount: 12.99, currency: "USD", precision: 2 },
      cadence: { unit: "month", count: 1 },
      shippingRequired: true,
    }]);
    expect(page.plans[0]).not.toHaveProperty("stripePriceId");
    expect(page.plans[0]).not.toHaveProperty("unitAmountMinor");
    expect(page.plans[0]).not.toHaveProperty("updatedAt");
  });

  it("applies public product and variant filters before count and pagination", async () => {
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    await service.create(PLAN);
    await service.create({
      ...PLAN,
      id: "plan_green",
      variantId: "var_green",
      stripePriceId: "price_green",
      cadence: { unit: "week", count: 2 },
    });
    const byProduct = await service.listPublic({
      productId: "prod_tea", limit: 1, offset: 1,
    });
    expect(byProduct.total).toBe(2);
    expect(byProduct.plans.map((plan) => plan.id)).toEqual(["plan_monthly"]);
    const byVariant = await service.listPublic({
      variantId: "var_green", limit: 100, offset: 0,
    });
    expect(byVariant.total).toBe(1);
    expect(byVariant.plans[0]).toMatchObject({ id: "plan_green", variant: { id: "var_green" } });
    const exactPair = await service.listPublic({
      productId: "prod_other", variantId: "var_green", limit: 100, offset: 0,
    });
    expect(exactPair).toMatchObject({ total: 0, plans: [] });
  });

  it("rejects mismatched bindings, currency, inactive catalog, and malformed provider facts", async () => {
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    await expect(service.create({ ...PLAN, productId: "prod_other" }))
      .rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await expect(service.create({ ...PLAN, currency: "EUR" }))
      .rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await expect(service.create({ ...PLAN, stripePriceId: "prod_not_a_price" }))
      .rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await expect(service.create({ ...PLAN, currency: "usd" }))
      .rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await expect(service.create({ ...PLAN, unitAmountMinor: 0 }))
      .rejects.toBeInstanceOf(SubscriptionPlanValidationError);
    await env.DB.prepare("UPDATE product_variants SET status = 'inactive' WHERE id = 'var_black'").run();
    await expect(service.create(PLAN)).rejects.toBeInstanceOf(SubscriptionPlanValidationError);
  });

  it("uses exact compare-and-swap updates and keeps deactivation possible", async () => {
    let current = new Date("2026-08-15T01:02:03.004Z");
    const verify = vi.fn(async () => undefined);
    const service = createSubscriptionPlanService(env.DB, {
      now: () => current,
      priceVerifier: { verify },
    });
    const created = await service.create(PLAN);
    current = new Date("2026-08-15T01:02:03.004Z");
    const deactivated = await service.update(
      PLAN.id,
      { active: false },
      created.updatedAt,
    );
    expect(deactivated).toMatchObject({ active: false, unitAmountMinor: 1299 });
    expect(deactivated.updatedAt).toBe("2026-08-15T01:02:03.005Z");
    expect(verify).toHaveBeenCalledTimes(1);
    await expect(service.update(PLAN.id, { active: false }, created.updatedAt))
      .rejects.toBeInstanceOf(SubscriptionPlanConflictError);
    await expect(service.update(PLAN.id, { active: true }, created.updatedAt))
      .rejects.toBeInstanceOf(SubscriptionPlanConflictError);
    await expect(service.listPublic({ limit: 20, offset: 0 }))
      .resolves.toMatchObject({ plans: [], total: 0 });
  });

  it("rejects competing active cadence and Stripe Price bindings without leaking SQL", async () => {
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    await service.create(PLAN);
    const duplicateCadence = service.create({
      ...PLAN,
      id: "plan_competing",
      stripePriceId: "price_competing",
    });
    await expect(duplicateCadence).rejects.toBeInstanceOf(SubscriptionPlanConflictError);
    await expect(duplicateCadence).rejects.not.toThrow(/UNIQUE|subscription_plans/i);
    await expect(service.create({
      ...PLAN,
      id: "plan_inactive",
      variantId: "var_green",
      stripePriceId: PLAN.stripePriceId,
      active: false,
    })).rejects.toBeInstanceOf(SubscriptionPlanConflictError);
  });

  it("removes deactivated plans from the public projection when catalog status changes", async () => {
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await service.create(PLAN);
    await env.DB.prepare("UPDATE products SET status = 'inactive' WHERE id = 'prod_tea'").run();
    await expect(service.listPublic({ limit: 20, offset: 0 }))
      .resolves.toMatchObject({ plans: [], total: 0 });
    const deactivated = await service.update(PLAN.id, { active: false }, created.updatedAt);
    expect(deactivated.active).toBe(false);
  });

  it("does not write a provider-mismatched plan", async () => {
    const service = createSubscriptionPlanService(env.DB, {
      priceVerifier: { verify: async () => { throw new SubscriptionPlanPriceMismatchError(); } },
    });
    await expect(service.create(PLAN)).rejects.toBeInstanceOf(SubscriptionPlanPriceMismatchError);
    const row = await env.DB.prepare("SELECT id FROM subscription_plans WHERE id = ?")
      .bind(PLAN.id).first<{ id: string }>();
    expect(row).toBeNull();
  });

  it("keeps provider-free deactivation available and leaves binding changes untouched on outage", async () => {
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await service.create(PLAN);
    const unavailable = vi.fn(async () => {
      throw new SubscriptionPlanPriceUnavailableError(new Error("provider unavailable"));
    });
    const outageService = createSubscriptionPlanService(env.DB, {
      priceVerifier: { verify: unavailable },
    });
    const deactivated = await outageService.update(PLAN.id, { active: false }, created.updatedAt);
    expect(deactivated.active).toBe(false);
    expect(unavailable).not.toHaveBeenCalled();

    await expect(outageService.update(
      PLAN.id,
      { unitAmountMinor: 1300 },
      deactivated.updatedAt,
    )).rejects.toBeInstanceOf(SubscriptionPlanPriceUnavailableError);
    const stored = await service.getAdmin(PLAN.id);
    expect(stored).toMatchObject({ unitAmountMinor: 1299, active: false });
  });

  it.each([
    ["malformed", "{not-json"],
    ["currency-drifted", JSON.stringify({ amount: 1500, currency: "EUR" })],
  ])("deactivates through %s catalog price data without provider validation", async (_label, price) => {
    const seeded = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await seeded.create(PLAN);
    await env.DB.prepare("UPDATE product_variants SET price = ? WHERE id = ?")
      .bind(price, PLAN.variantId).run();
    const verify = vi.fn(async () => {
      throw new SubscriptionPlanPriceUnavailableError(new Error("provider unavailable"));
    });
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: { verify } });

    const deactivated = await service.update(PLAN.id, { active: false }, created.updatedAt);

    expect(deactivated).toMatchObject({ id: PLAN.id, active: false, unitAmountMinor: 1299 });
    expect(verify).not.toHaveBeenCalled();
    await expect(env.DB.prepare("SELECT is_active FROM subscription_plans WHERE id = ?")
      .bind(PLAN.id).first<{ is_active: number }>()).resolves.toEqual({ is_active: 0 });
  });

  it("deactivates a plan whose catalog binding is missing", async () => {
    const seeded = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await seeded.create(PLAN);
    let catalogReads = 0;
    const missingCatalogStatement = {
      bind() { return this; },
      first: async () => null,
    } as unknown as D1PreparedStatement;
    const missingCatalog = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (query: string) => {
            if (query.includes("JOIN products p")) {
              catalogReads += 1;
              return missingCatalogStatement;
            }
            return target.prepare(query);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as D1Database;
    const verify = vi.fn(async () => {
      throw new SubscriptionPlanPriceUnavailableError(new Error("provider unavailable"));
    });
    const service = createSubscriptionPlanService(missingCatalog, { priceVerifier: { verify } });

    const deactivated = await service.update(
      PLAN.id,
      { active: false },
      created.updatedAt,
    );

    expect(deactivated).toMatchObject({
      id: PLAN.id,
      product: { id: PLAN.productId },
      variant: { id: PLAN.variantId },
      active: false,
    });
    expect(catalogReads).toBe(0);
    expect(verify).not.toHaveBeenCalled();
    await expect(env.DB.prepare("SELECT is_active FROM subscription_plans WHERE id = ?")
      .bind(PLAN.id).first<{ is_active: number }>()).resolves.toEqual({ is_active: 0 });
  });

  it("does not apply the rollback bypass to a simultaneous binding change", async () => {
    const seeded = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await seeded.create(PLAN);
    await env.DB.prepare("UPDATE product_variants SET price = '{not-json' WHERE id = ?")
      .bind(PLAN.variantId).run();
    const verify = vi.fn(async () => undefined);
    const service = createSubscriptionPlanService(env.DB, { priceVerifier: { verify } });

    await expect(service.update(
      PLAN.id,
      { active: false, unitAmountMinor: 1300 },
      created.updatedAt,
    )).rejects.toThrow("Stored catalog variant price is invalid");
    expect(verify).not.toHaveBeenCalled();
    await expect(env.DB.prepare(`SELECT unit_amount_minor, is_active
      FROM subscription_plans WHERE id = ?`).bind(PLAN.id)
      .first<{ unit_amount_minor: number; is_active: number }>())
      .resolves.toEqual({ unit_amount_minor: 1299, is_active: 1 });
  });

  it("does not resolve a lazy provider factory for list/get but does for a binding write", async () => {
    const seeded = createSubscriptionPlanService(env.DB, { priceVerifier: ACCEPT_PRICE });
    const created = await seeded.create(PLAN);
    const getClient = vi.fn(async () => ({
      prices: { retrieve: async (): Promise<never> => { throw new Error("provider unavailable"); } },
    }));
    const service = createSubscriptionPlanService(env.DB, {
      priceVerifier: createLazyStripePlanPriceVerifier(getClient),
    });
    await expect(service.listPublic({ limit: 20, offset: 0 })).resolves.toMatchObject({ total: 1 });
    await expect(service.listAdmin({ limit: 20, offset: 0 })).resolves.toMatchObject({ total: 1 });
    await expect(service.getAdmin(PLAN.id)).resolves.toMatchObject({ id: PLAN.id });
    expect(getClient).not.toHaveBeenCalled();

    await expect(service.update(
      PLAN.id,
      { unitAmountMinor: 1300 },
      created.updatedAt,
    )).rejects.toBeInstanceOf(SubscriptionPlanPriceUnavailableError);
    expect(getClient).toHaveBeenCalledTimes(1);
  });
});
