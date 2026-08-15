import { Money } from "@/lib/money";
import {
  assertLifecycleSnapshot,
  assertProviderSubscriptionMatchesAcquisition,
  assertSubscriptionAcquisition,
  subscriptionAcquisitionsEqual,
  type LifecycleEventCursor,
  type ProviderSubscriptionBinding,
  type SubscriptionAcquisition,
  type SubscriptionCadenceUnit,
  type SubscriptionConsent,
  type SubscriptionLifecycleSnapshot,
  type SubscriptionPlanBinding,
  type SubscriptionStatus,
} from "./domain";
import type { SubscriptionRepository } from "./ports";
import type { Address } from "@/lib/types";
import type {
  SubscriptionLifecycleNotificationKind,
  SubscriptionLifecycleNotificationRepository,
} from "./lifecycle-email";

type AcquisitionStatus = "pending" | "provider_created" | "completed" | "failed";

interface PlanRow {
  id: string;
  product_id: string;
  variant_id: string;
  currency_code: string;
  unit_amount_minor: number;
  stripe_price_id: string;
  cadence_unit: SubscriptionCadenceUnit;
  cadence_count: number;
  is_active: number;
  shipping_required: number;
}

interface AcquisitionRow {
  id: string;
  setup_intent_id: string;
  plan_id: string;
  product_id: string;
  variant_id: string;
  currency_code: string;
  unit_amount_minor: number;
  stripe_price_id: string;
  cadence_unit: SubscriptionCadenceUnit;
  cadence_count: number;
  customer_id: string;
  stripe_customer_id: string;
  quantity: number;
  shipping_required: number;
  shipping_address: string | null;
  consent_record: string;
  status: AcquisitionStatus;
  stripe_subscription_id: string | null;
}

interface SubscriptionRow {
  id: string;
  plan_id: string;
  customer_id: string;
  acquisition_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  quantity: number;
  shipping_required: number;
  status: SubscriptionStatus;
  shipping_address: string | null;
  consent_record: string;
  current_period_start: number | null;
  current_period_end: number | null;
  pause_collection: string | null;
  cancel_at_period_end: number;
  cancel_at: number | null;
  canceled_at: number | null;
  ended_at: number | null;
  latest_lifecycle_event_created_at: number;
  latest_lifecycle_event_id: string;
  version: number;
}

export interface CustomerSubscriptionRecord {
  id: string;
  planId: string;
  customerId: string;
  acquisitionId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  quantity: number;
  shippingRequired: boolean;
  status: SubscriptionStatus;
  shippingAddress?: Address;
  consent: SubscriptionConsent;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  pauseCollection?: NonNullable<SubscriptionLifecycleSnapshot["pauseCollection"]>;
  cancelAtPeriodEnd: boolean;
  cancelAt?: number;
  canceledAt?: number;
  endedAt?: number;
  latestLifecycleEvent: LifecycleEventCursor;
  version: number;
}

export type StoredAcquisition = {
  acquisition: SubscriptionAcquisition;
  status: AcquisitionStatus;
  stripeSubscriptionId?: string;
};

export type AcquirableSubscriptionPlan = SubscriptionPlanBinding & {
  shippingRequired: boolean;
};

export type SubscriptionEventType =
  | "created" | "updated" | "paused" | "resumed" | "canceled"
  | "renewed" | "payment_failed" | "payment_recovered" | "skipped";
export type SubscriptionEventOutcome =
  | "applied" | "duplicate" | "ignored_stale" | "refresh_required" | "failed";

function parseJson<T>(value: string | null, label: string): T | undefined {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Stored ${label} is invalid`, { cause: error });
  }
}

function mapPlan(row: PlanRow): SubscriptionPlanBinding {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    price: Money.fromMinor(row.unit_amount_minor, row.currency_code),
    stripePriceId: row.stripe_price_id,
    cadence: { unit: row.cadence_unit, count: row.cadence_count },
    shippingRequired: row.shipping_required === 1,
    active: row.is_active === 1,
  };
}

function mapAcquisition(row: AcquisitionRow): StoredAcquisition {
  const acquisition: SubscriptionAcquisition = {
    id: row.id,
    setupIntentId: row.setup_intent_id,
    customerId: row.customer_id,
    stripeCustomerId: row.stripe_customer_id,
    plan: {
      id: row.plan_id,
      productId: row.product_id,
      variantId: row.variant_id,
      price: Money.fromMinor(row.unit_amount_minor, row.currency_code),
      stripePriceId: row.stripe_price_id,
      cadence: { unit: row.cadence_unit, count: row.cadence_count },
      shippingRequired: row.shipping_required === 1,
    },
    quantity: row.quantity,
    shippingAddress: parseJson<Address>(row.shipping_address, "subscription shipping address"),
    consent: parseJson<SubscriptionConsent>(row.consent_record, "subscription consent")!,
  };
  assertSubscriptionAcquisition(acquisition);
  return {
    acquisition,
    status: row.status,
    ...(row.stripe_subscription_id ? { stripeSubscriptionId: row.stripe_subscription_id } : {}),
  };
}

function mapSubscription(row: SubscriptionRow): CustomerSubscriptionRecord {
  const result: CustomerSubscriptionRecord = {
    id: row.id,
    planId: row.plan_id,
    customerId: row.customer_id,
    acquisitionId: row.acquisition_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    quantity: row.quantity,
    shippingRequired: row.shipping_required === 1,
    status: row.status,
    shippingAddress: parseJson<Address>(row.shipping_address, "subscription shipping address"),
    consent: parseJson<SubscriptionConsent>(row.consent_record, "subscription consent")!,
    currentPeriodStart: row.current_period_start ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
    pauseCollection: parseJson(row.pause_collection, "subscription pause collection"),
    cancelAtPeriodEnd: row.cancel_at_period_end === 1,
    cancelAt: row.cancel_at ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    latestLifecycleEvent: {
      id: row.latest_lifecycle_event_id,
      createdAt: row.latest_lifecycle_event_created_at,
    },
    version: row.version,
  };
  assertLifecycleSnapshot(result);
  return result;
}

function acquisitionSelect(where: string): string {
  return `SELECT id, setup_intent_id, plan_id, product_id, variant_id,
    currency_code, unit_amount_minor, stripe_price_id, cadence_unit,
    cadence_count, customer_id, stripe_customer_id, quantity, shipping_required,
    shipping_address, consent_record, status, stripe_subscription_id
    FROM subscription_acquisitions WHERE ${where} LIMIT 1`;
}

const SUBSCRIPTION_SELECT = `SELECT id, plan_id, customer_id, acquisition_id,
  stripe_subscription_id, stripe_customer_id, quantity, shipping_required, status, shipping_address,
  consent_record, current_period_start, current_period_end, pause_collection,
  cancel_at_period_end, cancel_at, canceled_at, ended_at,
  latest_lifecycle_event_created_at, latest_lifecycle_event_id, version
  FROM customer_subscriptions`;

function providerMatches(left: ProviderSubscriptionBinding, right: ProviderSubscriptionBinding): boolean {
  return left.stripeSubscriptionId === right.stripeSubscriptionId
    && left.stripeCustomerId === right.stripeCustomerId
    && left.acquisitionId === right.acquisitionId
    && left.planId === right.planId
    && left.stripePriceId === right.stripePriceId
    && left.price.equals(right.price)
    && left.cadence.unit === right.cadence.unit
    && left.cadence.count === right.cadence.count
    && (left.shippingRequired === undefined || right.shippingRequired === undefined
      || left.shippingRequired === right.shippingRequired)
    && left.quantity === right.quantity;
}

function providerFromStored(stored: StoredAcquisition): ProviderSubscriptionBinding | undefined {
  if (!stored.stripeSubscriptionId) return undefined;
  return {
    acquisitionId: stored.acquisition.id,
    planId: stored.acquisition.plan.id,
    stripeSubscriptionId: stored.stripeSubscriptionId,
    stripeCustomerId: stored.acquisition.stripeCustomerId,
    stripePriceId: stored.acquisition.plan.stripePriceId,
    price: stored.acquisition.plan.price,
    cadence: stored.acquisition.plan.cadence,
    shippingRequired: stored.acquisition.plan.shippingRequired,
    quantity: stored.acquisition.quantity,
  };
}

export function createSubscriptionRepository(database: D1Database) {
  const findAcquisition = async (column: "id" | "setup_intent_id" | "stripe_subscription_id", value: string) => {
    const row = await database.prepare(acquisitionSelect(`${column} = ?`))
      .bind(value).first<AcquisitionRow>();
    return row ? mapAcquisition(row) : undefined;
  };

  const repository: SubscriptionRepository & SubscriptionLifecycleNotificationRepository & {
    findPlanById(
      planId: string,
      currency: string,
      options?: { allowInactive?: boolean },
    ): Promise<AcquirableSubscriptionPlan | undefined>;
    findAcquisitionById(id: string): Promise<StoredAcquisition | undefined>;
    findAcquisitionByStripeSubscription(id: string): Promise<StoredAcquisition | undefined>;
    findSubscriptionByStripeSubscription(id: string): Promise<CustomerSubscriptionRecord | undefined>;
    findSubscriptionForOwner(id: string, customerId: string): Promise<CustomerSubscriptionRecord | undefined>;
    listSubscriptionsForCustomer(customerId: string): Promise<CustomerSubscriptionRecord[]>;
    recordSubscriptionEvent(args: {
      id: string;
      subscriptionId: string;
      providerEvent: LifecycleEventCursor;
      eventType: SubscriptionEventType;
      outcome: SubscriptionEventOutcome;
      details?: Record<string, unknown>;
    }): Promise<boolean>;
  } = {
    async findProviderCustomer(customerId) {
      return await database.prepare(`SELECT customer_id AS customerId,
        stripe_customer_id AS stripeCustomerId
        FROM subscription_provider_customers WHERE customer_id = ? LIMIT 1`)
        .bind(customerId).first<{ customerId: string; stripeCustomerId: string }>() ?? undefined;
    },

    async bindProviderCustomer(args) {
      const result = await database.prepare(`INSERT OR IGNORE INTO subscription_provider_customers
        (customer_id, stripe_customer_id) VALUES (?, ?)`)
        .bind(args.customerId, args.stripeCustomerId).run();
      if ((result.meta.changes ?? 0) > 0) return "created";
      const winner = await this.findProviderCustomer(args.customerId);
      return winner?.stripeCustomerId === args.stripeCustomerId ? "identical" : "conflict";
    },

    async findActivePlan(args) {
      const row = await database.prepare(`SELECT sp.id, sp.product_id, sp.variant_id,
        sp.currency_code, sp.unit_amount_minor, sp.stripe_price_id, sp.cadence_unit,
        sp.cadence_count, sp.is_active, COALESCE(pv.shipping_required, 1) AS shipping_required
        FROM subscription_plans sp
        INNER JOIN products p ON p.id = sp.product_id AND p.status = 'active'
        INNER JOIN product_variants pv ON pv.id = sp.variant_id
          AND pv.product_id = sp.product_id AND pv.status = 'active'
        WHERE sp.product_id = ? AND sp.variant_id = ? AND sp.currency_code = ?
          AND stripe_price_id = ? AND cadence_unit = ? AND cadence_count = ?
          AND sp.is_active = 1 LIMIT 1`)
        .bind(args.productId, args.variantId, args.currency.toUpperCase(), args.stripePriceId,
          args.cadenceUnit, args.cadenceCount).first<PlanRow>();
      return row ? mapPlan(row) : undefined;
    },

    async findPlanById(planId, currency, options = {}) {
      const row = await database.prepare(`SELECT sp.id, sp.product_id, sp.variant_id,
        sp.currency_code, sp.unit_amount_minor, sp.stripe_price_id, sp.cadence_unit,
        sp.cadence_count, sp.is_active, COALESCE(pv.shipping_required, 1) AS shipping_required
        FROM subscription_plans sp
        INNER JOIN products p ON p.id = sp.product_id AND p.status = 'active'
        INNER JOIN product_variants pv ON pv.id = sp.variant_id
          AND pv.product_id = sp.product_id AND pv.status = 'active'
        WHERE sp.id = ? AND sp.currency_code = ?
          AND (? = 1 OR sp.is_active = 1) LIMIT 1`)
        .bind(planId, currency.toUpperCase(), options.allowInactive ? 1 : 0)
        .first<PlanRow & { shipping_required: number }>();
      return row ? mapPlan(row) : undefined;
    },

    async findAcquisitionBySetupIntent(setupIntentId) {
      return findAcquisition("setup_intent_id", setupIntentId);
    },

    async findAcquisitionById(id) {
      return findAcquisition("id", id);
    },

    async findAcquisitionByStripeSubscription(id) {
      return findAcquisition("stripe_subscription_id", id);
    },

    async reserveAcquisition(acquisition) {
      assertSubscriptionAcquisition(acquisition);
      const result = await database.prepare(`INSERT OR IGNORE INTO subscription_acquisitions
        (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
         unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
         customer_id, stripe_customer_id, quantity, shipping_required,
         shipping_address, consent_record)
        SELECT ?, ?, sp.id, sp.product_id, sp.variant_id, sp.currency_code,
          sp.unit_amount_minor, sp.stripe_price_id, sp.cadence_unit, sp.cadence_count,
          ?, ?, ?, ?, ?, ?
        FROM subscription_plans sp
        INNER JOIN products p ON p.id = sp.product_id AND p.status = 'active'
        INNER JOIN product_variants pv ON pv.id = sp.variant_id
          AND pv.product_id = sp.product_id AND pv.status = 'active'
        WHERE sp.id = ? AND sp.product_id = ? AND sp.variant_id = ?
          AND sp.currency_code = ? AND sp.unit_amount_minor = ?
          AND sp.stripe_price_id = ? AND sp.cadence_unit = ?
          AND sp.cadence_count = ? AND sp.is_active = 1
          AND COALESCE(pv.shipping_required, 1) = ?`)
        .bind(
          acquisition.id, acquisition.setupIntentId,
          acquisition.customerId, acquisition.stripeCustomerId, acquisition.quantity,
          acquisition.plan.shippingRequired ? 1 : 0,
          acquisition.shippingAddress ? JSON.stringify(acquisition.shippingAddress) : null,
          JSON.stringify(acquisition.consent),
          acquisition.plan.id, acquisition.plan.productId, acquisition.plan.variantId,
          acquisition.plan.price.currency, acquisition.plan.price.toMinorUnits(),
          acquisition.plan.stripePriceId, acquisition.plan.cadence.unit,
          acquisition.plan.cadence.count, acquisition.plan.shippingRequired ? 1 : 0,
        ).run();
      const winner = await findAcquisition("setup_intent_id", acquisition.setupIntentId);
      if (!winner || !subscriptionAcquisitionsEqual(winner.acquisition, acquisition)) {
        throw new SubscriptionAcquisitionConflictError();
      }
      return { acquisition: winner.acquisition, created: (result.meta.changes ?? 0) > 0 };
    },

    async recordProviderCreated({ acquisition, provider }) {
      assertProviderSubscriptionMatchesAcquisition(acquisition, provider);
      const durable = await findAcquisition("setup_intent_id", acquisition.setupIntentId);
      if (!durable || !subscriptionAcquisitionsEqual(durable.acquisition, acquisition)) return "conflict";
      const result = await database.prepare(`UPDATE subscription_acquisitions
        SET status = 'provider_created', stripe_subscription_id = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND status = 'pending' AND stripe_subscription_id IS NULL`)
        .bind(provider.stripeSubscriptionId, acquisition.id).run();
      if ((result.meta.changes ?? 0) > 0) return "updated";
      const winner = await findAcquisition("id", acquisition.id);
      const winnerProvider = winner ? providerFromStored(winner) : undefined;
      return winnerProvider && providerMatches(winnerProvider, provider) ? "already_recorded" : "conflict";
    },

    async completeAcquisitionFromLifecycleWebhook({ acquisition, provider, lifecycle, lifecycleEvent }) {
      assertProviderSubscriptionMatchesAcquisition(acquisition, provider);
      assertLifecycleSnapshot(lifecycle);
      const id = `subscription_${acquisition.id}`;
      const durable = await findAcquisition("id", acquisition.id);
      if (!durable || !subscriptionAcquisitionsEqual(durable.acquisition, acquisition)
        || durable.stripeSubscriptionId !== provider.stripeSubscriptionId
        || !["provider_created", "completed"].includes(durable.status)) {
        throw new SubscriptionAcquisitionConflictError();
      }
      const results = await database.batch([
        database.prepare(`INSERT OR IGNORE INTO customer_subscriptions
          (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
           stripe_customer_id, quantity, shipping_required, status, shipping_address, consent_record,
           current_period_start, current_period_end, pause_collection,
           cancel_at_period_end, cancel_at, canceled_at, ended_at,
           latest_lifecycle_event_created_at, latest_lifecycle_event_id)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          FROM subscription_acquisitions
          WHERE id = ? AND status IN ('provider_created', 'completed')
            AND stripe_subscription_id = ?`)
          .bind(id, acquisition.plan.id, acquisition.customerId, acquisition.id,
            provider.stripeSubscriptionId, acquisition.stripeCustomerId, acquisition.quantity,
            acquisition.plan.shippingRequired ? 1 : 0, lifecycle.status,
            acquisition.shippingAddress ? JSON.stringify(acquisition.shippingAddress) : null,
            JSON.stringify(acquisition.consent), lifecycle.currentPeriodStart ?? null,
            lifecycle.currentPeriodEnd ?? null,
            lifecycle.pauseCollection ? JSON.stringify(lifecycle.pauseCollection) : null,
            lifecycle.cancelAtPeriodEnd ? 1 : 0, lifecycle.cancelAt ?? null,
            lifecycle.canceledAt ?? null, lifecycle.endedAt ?? null,
            lifecycleEvent.createdAt, lifecycleEvent.id, acquisition.id,
            provider.stripeSubscriptionId),
        database.prepare(`UPDATE subscription_acquisitions SET status = 'completed',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ? AND status = 'provider_created' AND stripe_subscription_id = ?
            AND EXISTS (
              SELECT 1 FROM customer_subscriptions cs
              WHERE cs.id = ? AND cs.plan_id = ? AND cs.customer_id = ?
                AND cs.acquisition_id = ? AND cs.stripe_subscription_id = ?
                AND cs.stripe_customer_id = ? AND cs.quantity = ?
                AND cs.shipping_required = ? AND cs.status = ?
                AND cs.shipping_address IS ? AND cs.consent_record = ?
                AND cs.current_period_start IS ? AND cs.current_period_end IS ?
                AND cs.pause_collection IS ? AND cs.cancel_at_period_end = ?
                AND cs.cancel_at IS ? AND cs.canceled_at IS ? AND cs.ended_at IS ?
                AND cs.latest_lifecycle_event_created_at = ?
                AND cs.latest_lifecycle_event_id = ?
            )`)
          .bind(acquisition.id, provider.stripeSubscriptionId, id, acquisition.plan.id,
            acquisition.customerId, acquisition.id, provider.stripeSubscriptionId,
            acquisition.stripeCustomerId, acquisition.quantity,
            acquisition.plan.shippingRequired ? 1 : 0, lifecycle.status,
            acquisition.shippingAddress ? JSON.stringify(acquisition.shippingAddress) : null,
            JSON.stringify(acquisition.consent), lifecycle.currentPeriodStart ?? null,
            lifecycle.currentPeriodEnd ?? null,
            lifecycle.pauseCollection ? JSON.stringify(lifecycle.pauseCollection) : null,
            lifecycle.cancelAtPeriodEnd ? 1 : 0, lifecycle.cancelAt ?? null,
            lifecycle.canceledAt ?? null, lifecycle.endedAt ?? null,
            lifecycleEvent.createdAt, lifecycleEvent.id),
      ]);
      const winner = await repository.findSubscriptionByStripeSubscription(provider.stripeSubscriptionId);
      const completedAcquisition = await findAcquisition("id", acquisition.id);
      if (!winner || winner.acquisitionId !== acquisition.id || winner.planId !== acquisition.plan.id
        || winner.id !== id || winner.customerId !== acquisition.customerId
        || winner.stripeCustomerId !== acquisition.stripeCustomerId
        || winner.quantity !== acquisition.quantity
        || winner.shippingRequired !== acquisition.plan.shippingRequired
        || winner.status !== lifecycle.status
        || JSON.stringify(winner.shippingAddress) !== JSON.stringify(acquisition.shippingAddress)
        || JSON.stringify(winner.consent) !== JSON.stringify(acquisition.consent)
        || winner.currentPeriodStart !== lifecycle.currentPeriodStart
        || winner.currentPeriodEnd !== lifecycle.currentPeriodEnd
        || JSON.stringify(winner.pauseCollection) !== JSON.stringify(lifecycle.pauseCollection)
        || winner.cancelAtPeriodEnd !== lifecycle.cancelAtPeriodEnd
        || winner.cancelAt !== lifecycle.cancelAt || winner.canceledAt !== lifecycle.canceledAt
        || winner.endedAt !== lifecycle.endedAt
        || winner.latestLifecycleEvent.createdAt !== lifecycleEvent.createdAt
        || winner.latestLifecycleEvent.id !== lifecycleEvent.id
        || !completedAcquisition
        || completedAcquisition.status !== "completed"
        || completedAcquisition.stripeSubscriptionId !== provider.stripeSubscriptionId
        || !subscriptionAcquisitionsEqual(completedAcquisition.acquisition, acquisition)) {
        throw new SubscriptionAcquisitionConflictError();
      }
      return { id: winner.id, created: (results[0].meta.changes ?? 0) > 0 };
    },

    async compareAndApplyLifecycle({ subscriptionId, expected, incoming, snapshot }) {
      assertLifecycleSnapshot(snapshot);
      const result = await database.prepare(`UPDATE customer_subscriptions SET
        status = ?, quantity = ?, current_period_start = ?, current_period_end = ?,
        pause_collection = ?, cancel_at_period_end = ?, cancel_at = ?, canceled_at = ?,
        ended_at = ?, latest_lifecycle_event_created_at = ?, latest_lifecycle_event_id = ?,
        version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND latest_lifecycle_event_created_at = ? AND latest_lifecycle_event_id = ?`)
        .bind(snapshot.status, snapshot.quantity, snapshot.currentPeriodStart ?? null,
          snapshot.currentPeriodEnd ?? null,
          snapshot.pauseCollection ? JSON.stringify(snapshot.pauseCollection) : null,
          snapshot.cancelAtPeriodEnd ? 1 : 0, snapshot.cancelAt ?? null,
          snapshot.canceledAt ?? null, snapshot.endedAt ?? null,
          incoming.createdAt, incoming.id, subscriptionId, expected.createdAt, expected.id).run();
      if ((result.meta.changes ?? 0) > 0) return "applied";
      const current = await database.prepare(`${SUBSCRIPTION_SELECT} WHERE id = ? LIMIT 1`)
        .bind(subscriptionId).first<SubscriptionRow>();
      if (current?.latest_lifecycle_event_created_at === incoming.createdAt
        && current.latest_lifecycle_event_id === incoming.id) return "already_applied";
      return "conflict";
    },

    async findSubscriptionByStripeSubscription(id) {
      const row = await database.prepare(`${SUBSCRIPTION_SELECT}
        WHERE stripe_subscription_id = ? LIMIT 1`).bind(id).first<SubscriptionRow>();
      return row ? mapSubscription(row) : undefined;
    },

    async findSubscriptionForOwner(id, customerId) {
      const row = await database.prepare(`${SUBSCRIPTION_SELECT}
        WHERE id = ? AND customer_id = ? LIMIT 1`).bind(id, customerId).first<SubscriptionRow>();
      return row ? mapSubscription(row) : undefined;
    },

    async listSubscriptionsForCustomer(customerId) {
      const result = await database.prepare(`${SUBSCRIPTION_SELECT}
        WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`)
        .bind(customerId).all<SubscriptionRow>();
      return result.results.map(mapSubscription);
    },

    async findSubscriptionEventNotificationKind(eventAuditId) {
      const row = await database.prepare(`SELECT
        json_extract(details, '$.notification_kind') AS notificationKind
        FROM subscription_events
        WHERE id = ? AND json_valid(COALESCE(details, '{}')) = 1 LIMIT 1`)
        .bind(eventAuditId)
        .first<{ notificationKind: string | null }>();
      const allowed: SubscriptionLifecycleNotificationKind[] = [
        'created', 'paused', 'resumed', 'cancel_scheduled', 'canceled',
        'payment_failed', 'payment_recovered',
      ];
      return allowed.find((kind) => kind === row?.notificationKind);
    },

    async recordSubscriptionEvent(args) {
      if (!/^[^\s]{1,128}$/.test(args.id)
        || !/^[^\s]{1,128}$/.test(args.subscriptionId)
        || !/^[^\s]{1,255}$/.test(args.providerEvent.id)
        || !Number.isSafeInteger(args.providerEvent.createdAt) || args.providerEvent.createdAt < 0) {
        throw new TypeError("Subscription event identifiers are invalid");
      }
      const eventTypes: SubscriptionEventType[] = [
        "created", "updated", "paused", "resumed", "canceled", "renewed",
        "payment_failed", "payment_recovered", "skipped",
      ];
      const outcomes: SubscriptionEventOutcome[] = [
        "applied", "duplicate", "ignored_stale", "refresh_required", "failed",
      ];
      if (!eventTypes.includes(args.eventType) || !outcomes.includes(args.outcome)) {
        throw new TypeError("Subscription event classification is invalid");
      }
      const details = args.details === undefined ? null : JSON.stringify(args.details);
      if (details !== null && new TextEncoder().encode(details).byteLength > 32_768) {
        throw new TypeError("Subscription event details are too large");
      }
      const result = await database.prepare(`INSERT OR IGNORE INTO subscription_events
        (id, subscription_id, provider_event_id, provider_event_created_at,
         event_type, outcome, details) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(args.id, args.subscriptionId, args.providerEvent.id,
          args.providerEvent.createdAt, args.eventType, args.outcome, details).run();
      return (result.meta.changes ?? 0) > 0;
    },
  };
  return repository;
}

export class SubscriptionAcquisitionConflictError extends Error {
  constructor() {
    super("Subscription acquisition conflicts with an existing request");
  }
}
