import type { Address } from "@/lib/types";
import type { SubscriptionProvider } from "./ports";
import {
  subscriptionAcquisitionsEqual,
  toProviderAcquisitionRequest,
  toReservedSubscriptionPlanBinding,
  type ProviderAcquisitionRequest,
  type ProviderSubscriptionBinding,
  type SubscriptionLifecycleSnapshot,
} from "./domain";
import {
  SubscriptionAcquisitionConflictError,
  type CustomerSubscriptionRecord,
  type StoredAcquisition,
  createSubscriptionRepository,
} from "./repository";
import { normalizeStripeCurrency } from "./stripe-mappers";
import { createStripeSubscriptionAdapter } from "./stripe-provider";
import { getStripeClient } from "@/lib/stripe";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface SubscriptionAcquisitionProvider extends SubscriptionProvider {
  createProviderCustomer(args: {
    customerId: string;
    email: string;
    name?: string;
    idempotencyKey: string;
  }): Promise<{ customerId: string; stripeCustomerId: string }>;
  retrieveProviderCustomer(args: {
    customerId: string;
    stripeCustomerId: string;
  }): Promise<{ customerId: string; stripeCustomerId: string }>;
  createSetupIntent(args: {
    customerId: string;
    stripeCustomerId: string;
    idempotencyKey: string;
  }): Promise<{
    setupIntentId: string;
    clientSecret: string | null;
    /** Provider-authored stable timestamp for idempotent consent capture. */
    createdAt: number;
    stripeCustomerId: string;
  }>;
  retrieveVerifiedSetupIntent(args: {
    setupIntentId: string;
    expectedStripeCustomerId: string;
    expectedCustomerId: string;
  }): Promise<{
    setupIntentId: string;
    stripeCustomerId: string;
    paymentMethodId: string;
  }>;
  pauseCollection(args: {
    stripeSubscriptionId: string;
    behavior: "void";
    idempotencyKey: string;
  }): Promise<SubscriptionLifecycleSnapshot>;
  resumeCollection(args: {
    stripeSubscriptionId: string;
    idempotencyKey: string;
  }): Promise<SubscriptionLifecycleSnapshot>;
  cancelSubscription(args: {
    stripeSubscriptionId: string;
    mode: "period_end" | "immediate";
    idempotencyKey: string;
  }): Promise<SubscriptionLifecycleSnapshot>;
}

export interface BeginSubscriptionAcquisitionInput {
  customerId: string;
  customerEmail: string;
  customerName?: string;
  idempotencyKey: string;
  planId: string;
  currency: string;
  quantity: number;
  shippingAddress?: Address;
  termsVersion: string;
}

export interface SubscriptionAcquisitionResult {
  acquisitionId: string;
  setupIntentId: string;
  clientSecret: string;
}

export interface SafeSubscriptionSummary {
  id: string;
  planId: string;
  quantity: number;
  status: CustomerSubscriptionRecord["status"] | "pending" | "provider_created";
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: number;
  canceledAt?: number;
  endedAt?: number;
}

export type SubscriptionAction =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cancel"; mode: "period_end" | "immediate" };

type Repository = ReturnType<typeof createSubscriptionRepository>;

export interface SubscriptionAcquisitionService {
  begin(input: BeginSubscriptionAcquisitionInput): Promise<SubscriptionAcquisitionResult>;
  finalize(customerId: string, setupIntentId: string): Promise<SafeSubscriptionSummary>;
  list(customerId: string): Promise<SafeSubscriptionSummary[]>;
  act(customerId: string, subscriptionId: string, action: SubscriptionAction): Promise<{
    subscription: SafeSubscriptionSummary;
    reconciliationPending: true;
  }>;
}

export class SubscriptionNotFoundError extends Error {}
export class SubscriptionProviderConflictError extends Error {}

async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(parts.join("\u0000"));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 48)}`;
}

function isoFromEpochSeconds(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SubscriptionProviderConflictError("Provider returned an invalid creation time");
  }
  return new Date(value * 1000).toISOString();
}

function validateBeginInput(input: BeginSubscriptionAcquisitionInput): void {
  if (!/^[^\s]{1,128}$/.test(input.customerId)
    || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)
    || !/^[^\s]{1,128}$/.test(input.planId)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)
    || input.customerEmail.length > 320
    || (input.customerName !== undefined
      && (input.customerName.trim() !== input.customerName || input.customerName.length < 1
        || input.customerName.length > 200))
    || !Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000
    || input.termsVersion.trim() !== input.termsVersion
    || input.termsVersion.length < 1 || input.termsVersion.length > 200) {
    throw new TypeError("Subscription acquisition input is invalid");
  }
  normalizeStripeCurrency(input.currency);
  if (input.shippingAddress !== undefined) {
    const address = input.shippingAddress;
    const allowed = new Set([
      "line1", "line2", "city", "region", "postal_code", "country", "company",
      "recipient", "phone", "email", "delivery_instructions", "type", "status",
    ]);
    if (Object.getPrototypeOf(address) !== Object.prototype
      || Object.keys(address).some((key) => !allowed.has(key))
      || typeof address.line1 !== "string" || address.line1.trim().length < 1 || address.line1.length > 256
      || typeof address.city !== "string" || address.city.trim().length < 1 || address.city.length > 128
      || typeof address.country !== "string" || !/^[A-Z]{2}$/.test(address.country)
      || (address.type !== undefined && address.type !== "shipping")
      || (address.status !== undefined && !["active", "verified", "unverified"].includes(address.status))
      || Object.values(address).some((entry) => typeof entry === "object" && entry !== null)
      || new TextEncoder().encode(JSON.stringify(address)).byteLength > 32_768) {
      throw new TypeError("Subscription shipping address is invalid");
    }
    const bounds: Record<string, number> = {
      line2: 256, region: 128, postal_code: 32, company: 200, recipient: 200,
      phone: 40, email: 320, delivery_instructions: 500,
    };
    for (const [key, max] of Object.entries(bounds)) {
      const value = address[key as keyof Address];
      if (value !== undefined && (typeof value !== "string" || value.length > max
        || value.trim() !== value)) {
        throw new TypeError("Subscription shipping address is invalid");
      }
    }
    if (address.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      throw new TypeError("Subscription shipping address is invalid");
    }
  }
}

function safeSummary(record: CustomerSubscriptionRecord): SafeSubscriptionSummary {
  return {
    id: record.id,
    planId: record.planId,
    quantity: record.quantity,
    status: record.status,
    currentPeriodStart: record.currentPeriodStart,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    cancelAt: record.cancelAt,
    canceledAt: record.canceledAt,
    endedAt: record.endedAt,
  };
}

function pendingSummary(stored: StoredAcquisition): SafeSubscriptionSummary {
  return {
    id: stored.acquisition.id,
    planId: stored.acquisition.plan.id,
    quantity: stored.acquisition.quantity,
    status: stored.status === "pending" ? "pending" : "provider_created",
  };
}

function sameRequestedFacts(
  stored: StoredAcquisition,
  input: Omit<BeginSubscriptionAcquisitionInput, "customerEmail" | "customerName" | "idempotencyKey">,
  stripeCustomerId: string,
): boolean {
  return subscriptionAcquisitionsEqual(stored.acquisition, {
    ...stored.acquisition,
    customerId: input.customerId,
    stripeCustomerId,
    plan: stored.acquisition.plan.id === input.planId
      ? stored.acquisition.plan
      : { ...stored.acquisition.plan, id: input.planId },
    quantity: input.quantity,
    shippingAddress: input.shippingAddress,
    consent: { ...stored.acquisition.consent, termsVersion: input.termsVersion },
  });
}

async function establishProviderCustomer(args: {
  repository: Repository;
  provider: SubscriptionAcquisitionProvider;
  input: BeginSubscriptionAcquisitionInput;
}): Promise<string> {
  const existing = await args.repository.findProviderCustomer(args.input.customerId);
  if (existing) {
    const verified = await args.provider.retrieveProviderCustomer({
      customerId: args.input.customerId,
      stripeCustomerId: existing.stripeCustomerId,
    });
    if (verified.customerId !== args.input.customerId
      || verified.stripeCustomerId !== existing.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return existing.stripeCustomerId;
  }

  const idempotencyKey = await stableId("subscription-customer", args.input.customerId);
  const created = await args.provider.createProviderCustomer({
    customerId: args.input.customerId,
    email: args.input.customerEmail,
    name: args.input.customerName,
    idempotencyKey,
  });
  if (created.customerId !== args.input.customerId) {
    throw new SubscriptionProviderConflictError("Provider customer ownership changed");
  }
  const result = await args.repository.bindProviderCustomer({
    customerId: args.input.customerId,
    stripeCustomerId: created.stripeCustomerId,
  });
  if (result === "conflict") {
    const winner = await args.repository.findProviderCustomer(args.input.customerId);
    if (!winner) throw new SubscriptionProviderConflictError("Provider customer mapping did not converge");
    const verified = await args.provider.retrieveProviderCustomer({
      customerId: args.input.customerId,
      stripeCustomerId: winner.stripeCustomerId,
    });
    if (verified.customerId !== args.input.customerId
      || verified.stripeCustomerId !== winner.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return verified.stripeCustomerId;
  }
  return created.stripeCustomerId;
}

export function createSubscriptionAcquisitionService(args: {
  repository: Repository;
  provider: SubscriptionAcquisitionProvider;
}): SubscriptionAcquisitionService {
  const { repository, provider } = args;
  return {
    async begin(input) {
      validateBeginInput(input);
      const currency = normalizeStripeCurrency(input.currency);
      const acquisitionId = await stableId("acq", input.customerId, input.idempotencyKey);
      const existing = await repository.findAcquisitionById(acquisitionId);
      const plan = existing
        ? { ...existing.acquisition.plan, active: false, shippingRequired: false }
        : await repository.findPlanById(input.planId, currency);
      if (!plan || plan.id !== input.planId || plan.price.currency !== currency) {
        throw new SubscriptionNotFoundError("Subscription plan is unavailable");
      }
      if (!existing && plan.shippingRequired && input.shippingAddress === undefined) {
        throw new TypeError("A shipping address is required for this subscription plan");
      }
      const stripeCustomerId = await establishProviderCustomer({ repository, provider, input });
      const setupIdempotencyKey = await stableId("subscription-setup", acquisitionId);

      if (existing && !sameRequestedFacts(existing, input, stripeCustomerId)) {
        throw new SubscriptionAcquisitionConflictError();
      }

      const setupIntent = await provider.createSetupIntent({
        customerId: input.customerId,
        stripeCustomerId,
        idempotencyKey: setupIdempotencyKey,
      });
      if (!setupIntent.clientSecret) {
        throw new SubscriptionProviderConflictError("Provider SetupIntent has no client secret");
      }
      if (setupIntent.stripeCustomerId !== stripeCustomerId) {
        throw new SubscriptionProviderConflictError("Provider SetupIntent ownership changed");
      }
      if (existing && existing.acquisition.setupIntentId !== setupIntent.setupIntentId) {
        throw new SubscriptionProviderConflictError("Provider SetupIntent identity changed");
      }

      const acquisition = existing?.acquisition ?? {
        id: acquisitionId,
        setupIntentId: setupIntent.setupIntentId,
        customerId: input.customerId,
        stripeCustomerId,
        plan: toReservedSubscriptionPlanBinding(plan),
        quantity: input.quantity,
        shippingAddress: input.shippingAddress,
        consent: {
          termsVersion: input.termsVersion,
          acceptedAt: isoFromEpochSeconds(setupIntent.createdAt),
          source: "checkout" as const,
        },
      };
      const reserved = await repository.reserveAcquisition(acquisition);
      return {
        acquisitionId: reserved.acquisition.id,
        setupIntentId: reserved.acquisition.setupIntentId,
        clientSecret: setupIntent.clientSecret,
      };
    },

    async finalize(customerId, setupIntentId) {
      if (!/^[^\s]{1,128}$/.test(customerId)
        || !/^seti_[A-Za-z0-9_]{1,250}$/.test(setupIntentId)
        || setupIntentId.length > 255) {
        throw new TypeError("Subscription finalization input is invalid");
      }
      const stored = await repository.findAcquisitionBySetupIntent(setupIntentId);
      if (!stored || stored.acquisition.customerId !== customerId) throw new SubscriptionNotFoundError();

      if (stored.status === "completed" && stored.stripeSubscriptionId) {
        const local = await repository.findSubscriptionByStripeSubscription(stored.stripeSubscriptionId);
        if (local) return safeSummary(local);
      }

      const verified = await provider.retrieveVerifiedSetupIntent({
        setupIntentId,
        expectedStripeCustomerId: stored.acquisition.stripeCustomerId,
        expectedCustomerId: stored.acquisition.customerId,
      });
      if (verified.setupIntentId !== setupIntentId
        || verified.stripeCustomerId !== stored.acquisition.stripeCustomerId
        || !verified.paymentMethodId) {
        throw new SubscriptionProviderConflictError("SetupIntent verification failed");
      }

      const request: ProviderAcquisitionRequest = toProviderAcquisitionRequest(stored.acquisition);
      const providerSubscription: ProviderSubscriptionBinding = await provider.createSubscription(request);
      const recorded = await repository.recordProviderCreated({
        acquisition: stored.acquisition,
        provider: providerSubscription,
      });
      if (recorded === "conflict") {
        throw new SubscriptionProviderConflictError("Provider subscription did not converge");
      }
      const local = await repository.findSubscriptionByStripeSubscription(
        providerSubscription.stripeSubscriptionId,
      );
      return local ? safeSummary(local) : {
        id: stored.acquisition.id,
        planId: stored.acquisition.plan.id,
        quantity: stored.acquisition.quantity,
        status: "provider_created",
      };
    },

    async list(customerId) {
      return (await repository.listSubscriptionsForCustomer(customerId)).map(safeSummary);
    },

    async act(customerId, subscriptionId, action) {
      const stored = await repository.findSubscriptionForOwner(subscriptionId, customerId);
      if (!stored) throw new SubscriptionNotFoundError();
      const actionName = action.type === "cancel" ? `${action.type}:${action.mode}` : action.type;
      const idempotencyKey = await stableId(
        "subscription-action",
        stored.id,
        String(stored.version),
        stored.latestLifecycleEvent.id,
        String(stored.latestLifecycleEvent.createdAt),
        actionName,
      );
      if (action.type === "pause") {
        if (!stored.pauseCollection) {
          await provider.pauseCollection({
            stripeSubscriptionId: stored.stripeSubscriptionId,
            behavior: "void",
            idempotencyKey,
          });
        }
      } else if (action.type === "resume") {
        if (stored.pauseCollection) {
          await provider.resumeCollection({
            stripeSubscriptionId: stored.stripeSubscriptionId,
            idempotencyKey,
          });
        }
      } else {
        const alreadyApplied = stored.status === "canceled"
          || (action.mode === "period_end" && stored.cancelAtPeriodEnd);
        if (!alreadyApplied) {
          await provider.cancelSubscription({
            stripeSubscriptionId: stored.stripeSubscriptionId,
            mode: action.mode,
            idempotencyKey,
          });
        }
      }
      // Only a signed webhook advances the local lifecycle cursor. The action
      // response therefore reflects durable state and explicitly marks refresh pending.
      return { subscription: safeSummary(stored), reconciliationPending: true };
    },
  };
}

/** Request-scoped default wiring; tests inject the narrow service/provider instead. */
export async function getSubscriptionAcquisitionService(): Promise<SubscriptionAcquisitionService> {
  const { env } = await getCloudflareContext({ async: true });
  const repository = createSubscriptionRepository(env.DB);
  const provider = createStripeSubscriptionAdapter(getStripeClient());
  return createSubscriptionAcquisitionService({ repository, provider });
}
