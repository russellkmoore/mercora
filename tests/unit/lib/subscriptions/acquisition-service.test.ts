import { beforeEach, describe, expect, it, vi } from "vitest";
import { Money } from "@/lib/money";
import {
  createSubscriptionAcquisitionService,
  SubscriptionNotFoundError,
  SubscriptionProviderConflictError,
  type SubscriptionAcquisitionProvider,
} from "@/lib/subscriptions/acquisition-service";
import type { SubscriptionAcquisition } from "@/lib/subscriptions/domain";
import { SubscriptionAcquisitionConflictError } from "@/lib/subscriptions/repository";

const plan = {
  id: "plan_one",
  productId: "prod_one",
  variantId: "var_one",
  price: Money.fromMinor(1200, "USD"),
  stripePriceId: "price_one",
  cadence: { unit: "month" as const, count: 1 },
  active: true,
  shippingRequired: true,
};

function storedAcquisition(): { acquisition: SubscriptionAcquisition; status: "pending" } {
  return {
    acquisition: {
      id: "acq_existing",
      setupIntentId: "seti_existing",
      customerId: "user_one",
      stripeCustomerId: "cus_one",
      plan: {
        id: plan.id,
        productId: plan.productId,
        variantId: plan.variantId,
        price: plan.price,
        stripePriceId: plan.stripePriceId,
        cadence: plan.cadence,
      },
      quantity: 1,
      shippingAddress: { line1: "1 Main", city: "Denver", country: "US" },
      consent: {
        termsVersion: "terms-1",
        acceptedAt: "2026-08-14T00:00:00.000Z",
        source: "checkout",
      },
    },
    status: "pending",
  };
}

function mocks() {
  const repository = {
    findActivePlan: vi.fn(),
    findPlanById: vi.fn().mockResolvedValue(plan),
    findAcquisitionById: vi.fn().mockResolvedValue(undefined),
    findProviderCustomer: vi.fn().mockResolvedValue(undefined),
    bindProviderCustomer: vi.fn().mockResolvedValue("created"),
    reserveAcquisition: vi.fn(async (acquisition: SubscriptionAcquisition) => ({ acquisition, created: true })),
    findAcquisitionBySetupIntent: vi.fn(),
    recordProviderCreated: vi.fn().mockResolvedValue("updated"),
    findSubscriptionByStripeSubscription: vi.fn(),
    listSubscriptionsForCustomer: vi.fn().mockResolvedValue([]),
    findSubscriptionForOwner: vi.fn(),
  };
  const provider = {
    createProviderCustomer: vi.fn().mockResolvedValue({
      customerId: "user_one", stripeCustomerId: "cus_one", livemode: false,
    }),
    retrieveProviderCustomer: vi.fn().mockResolvedValue({
      customerId: "user_one", stripeCustomerId: "cus_one", livemode: false,
    }),
    createSetupIntent: vi.fn().mockResolvedValue({
      setupIntentId: "seti_one", clientSecret: "seti_secret", createdAt: 1_776_124_800,
      stripeCustomerId: "cus_one", status: "requires_payment_method", livemode: false,
    }),
    retrieveVerifiedSetupIntent: vi.fn(),
    createSubscription: vi.fn(),
    retrieveLifecycle: vi.fn(),
    pauseCollection: vi.fn(),
    resumeCollection: vi.fn(),
    cancelSubscription: vi.fn(),
  };
  const service = createSubscriptionAcquisitionService({
    repository: repository as never,
    provider: provider as unknown as SubscriptionAcquisitionProvider,
  });
  return { repository, provider, service };
}

const beginInput = {
  customerId: "user_one",
  customerEmail: "one@example.test",
  customerName: "One Customer",
  idempotencyKey: "checkout-key-001",
  planId: "plan_one",
  currency: "USD",
  quantity: 1,
  shippingAddress: { line1: "1 Main", city: "Denver", country: "US" } as const,
  termsVersion: "terms-1",
};

describe("subscription acquisition service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a physical plan without an address before any provider call", async () => {
    const { service, provider } = mocks();
    await expect(service.begin({ ...beginInput, shippingAddress: undefined }))
      .rejects.toThrow("shipping address");
    expect(provider.createProviderCustomer).not.toHaveBeenCalled();
    expect(provider.createSetupIntent).not.toHaveBeenCalled();
  });

  it("derives customer authority and stable consent from the provider SetupIntent", async () => {
    const { service, repository, provider } = mocks();
    const result = await service.begin(beginInput);
    expect(result).toMatchObject({ setupIntentId: "seti_one", clientSecret: "seti_secret" });
    expect(provider.createProviderCustomer).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "user_one",
      email: "one@example.test",
      name: "One Customer",
    }));
    const reserved = repository.reserveAcquisition.mock.calls[0][0];
    expect(reserved.consent).toEqual({
      termsVersion: "terms-1",
      acceptedAt: "2026-04-14T00:00:00.000Z",
      source: "checkout",
    });
  });

  it("reuses immutable acquisition facts without rejoining deactivated catalog rows", async () => {
    const { service, repository, provider } = mocks();
    const stored = storedAcquisition();
    // Stable acquisition id is opaque, so return the winner for this retry.
    repository.findAcquisitionById.mockResolvedValue(stored);
    repository.findProviderCustomer.mockResolvedValue({ customerId: "user_one", stripeCustomerId: "cus_one" });
    provider.createSetupIntent.mockResolvedValue({
      setupIntentId: "seti_existing", clientSecret: "secret", createdAt: 1,
      stripeCustomerId: "cus_one", status: "requires_payment_method", livemode: false,
    });
    await service.begin(beginInput);
    expect(repository.findPlanById).not.toHaveBeenCalled();
    expect(provider.retrieveProviderCustomer).toHaveBeenCalledWith({
      customerId: "user_one", stripeCustomerId: "cus_one",
    });
  });

  it("rejects a terminally failed begin retry before provider access or D1 mutation", async () => {
    const { service, repository, provider } = mocks();
    repository.findAcquisitionById.mockResolvedValue({
      ...storedAcquisition(),
      status: "failed",
      stripeSubscriptionId: "sub_failed",
    });

    await expect(service.begin(beginInput))
      .rejects.toBeInstanceOf(SubscriptionAcquisitionConflictError);

    expect(repository.findPlanById).not.toHaveBeenCalled();
    expect(repository.findProviderCustomer).not.toHaveBeenCalled();
    expect(repository.bindProviderCustomer).not.toHaveBeenCalled();
    expect(repository.reserveAcquisition).not.toHaveBeenCalled();
    expect(provider.createProviderCustomer).not.toHaveBeenCalled();
    expect(provider.retrieveProviderCustomer).not.toHaveBeenCalled();
    expect(provider.createSetupIntent).not.toHaveBeenCalled();
  });

  it("rejects changed idempotent facts before mutating the SetupIntent", async () => {
    const { service, repository, provider } = mocks();
    repository.findAcquisitionById.mockResolvedValue(storedAcquisition());
    await expect(service.begin({ ...beginInput, quantity: 2 })).rejects.toThrow("conflicts");
    expect(provider.createSetupIntent).not.toHaveBeenCalled();
  });

  it("re-reads and verifies the durable customer winner after a bind race", async () => {
    const { service, repository, provider } = mocks();
    repository.findProviderCustomer
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ customerId: "user_one", stripeCustomerId: "cus_winner" });
    repository.bindProviderCustomer.mockResolvedValue("conflict");
    provider.createProviderCustomer.mockResolvedValue({ customerId: "user_one", stripeCustomerId: "cus_loser" });
    provider.retrieveProviderCustomer.mockResolvedValue({ customerId: "user_one", stripeCustomerId: "cus_winner" });
    provider.createSetupIntent.mockResolvedValue({
      setupIntentId: "seti_one", clientSecret: "secret", createdAt: 1,
      stripeCustomerId: "cus_winner", status: "requires_payment_method", livemode: false,
    });
    await service.begin(beginInput);
    expect(provider.retrieveProviderCustomer).toHaveBeenCalledWith({
      customerId: "user_one", stripeCustomerId: "cus_winner",
    });
    expect(provider.createSetupIntent).toHaveBeenCalledWith(expect.objectContaining({
      stripeCustomerId: "cus_winner",
    }));
  });

  it("validates finalize identifiers before querying D1", async () => {
    const { service, repository } = mocks();
    await expect(service.finalize("user_one", "bad")).rejects.toThrow("invalid");
    expect(repository.findAcquisitionBySetupIntent).not.toHaveBeenCalled();
  });

  it("masks owner mismatch before provider finalization", async () => {
    const { service, repository, provider } = mocks();
    repository.findAcquisitionBySetupIntent.mockResolvedValue(storedAcquisition());
    await expect(service.finalize("user_other", "seti_existing"))
      .rejects.toBeInstanceOf(SubscriptionNotFoundError);
    expect(provider.retrieveVerifiedSetupIntent).not.toHaveBeenCalled();
  });

  it("rejects a terminally failed finalization before provider access or D1 mutation", async () => {
    const { service, repository, provider } = mocks();
    repository.findAcquisitionBySetupIntent.mockResolvedValue({
      ...storedAcquisition(),
      status: "failed",
      stripeSubscriptionId: "sub_failed",
    });

    await expect(service.finalize("user_one", "seti_existing"))
      .rejects.toBeInstanceOf(SubscriptionNotFoundError);

    expect(repository.findSubscriptionByStripeSubscription).not.toHaveBeenCalled();
    expect(repository.recordProviderCreated).not.toHaveBeenCalled();
    expect(provider.retrieveVerifiedSetupIntent).not.toHaveBeenCalled();
    expect(provider.createSubscription).not.toHaveBeenCalled();
  });

  it("rejects mismatched verified SetupIntent and provider-record conflicts", async () => {
    const { service, repository, provider } = mocks();
    const stored = storedAcquisition();
    repository.findAcquisitionBySetupIntent.mockResolvedValue(stored);
    provider.retrieveVerifiedSetupIntent.mockResolvedValue({
      setupIntentId: "seti_other", stripeCustomerId: "cus_one", paymentMethodId: "pm_one",
    });
    await expect(service.finalize("user_one", "seti_existing"))
      .rejects.toBeInstanceOf(SubscriptionProviderConflictError);
    expect(provider.createSubscription).not.toHaveBeenCalled();

    provider.retrieveVerifiedSetupIntent.mockResolvedValue({
      setupIntentId: "seti_existing", stripeCustomerId: "cus_one", paymentMethodId: "pm_one",
    });
    provider.createSubscription.mockResolvedValue({
      acquisitionId: stored.acquisition.id,
      planId: stored.acquisition.plan.id,
      stripeSubscriptionId: "sub_one",
      stripeCustomerId: "cus_one",
      stripePriceId: stored.acquisition.plan.stripePriceId,
      price: stored.acquisition.plan.price,
      cadence: stored.acquisition.plan.cadence,
      quantity: 1,
    });
    repository.recordProviderCreated.mockResolvedValue("conflict");
    await expect(service.finalize("user_one", "seti_existing"))
      .rejects.toBeInstanceOf(SubscriptionProviderConflictError);
  });

  it("returns the durable local row for a completed acquisition retry", async () => {
    const { service, repository, provider } = mocks();
    const stored = { ...storedAcquisition(), status: "completed" as const, stripeSubscriptionId: "sub_one" };
    repository.findAcquisitionBySetupIntent.mockResolvedValue(stored);
    repository.findSubscriptionByStripeSubscription.mockResolvedValue({
      id: "subscription_acq_one", planId: "plan_one", customerId: "user_one",
      acquisitionId: "acq_one", stripeSubscriptionId: "sub_one", stripeCustomerId: "cus_one",
      quantity: 1, status: "active", consent: stored.acquisition.consent,
      cancelAtPeriodEnd: false, latestLifecycleEvent: { id: "evt_one", createdAt: 1 }, version: 1,
    });
    await expect(service.finalize("user_one", "seti_existing")).resolves.toMatchObject({
      id: "subscription_acq_one", status: "active",
    });
    expect(provider.retrieveVerifiedSetupIntent).not.toHaveBeenCalled();
  });

  it("uses one durable action idempotency key until a signed lifecycle update", async () => {
    const { service, repository, provider } = mocks();
    repository.findSubscriptionForOwner.mockResolvedValue({
      id: "subscription_acq_one",
      planId: "plan_one",
      customerId: "user_one",
      acquisitionId: "acq_one",
      stripeSubscriptionId: "sub_one",
      stripeCustomerId: "cus_one",
      quantity: 1,
      status: "active",
      consent: storedAcquisition().acquisition.consent,
      cancelAtPeriodEnd: false,
      latestLifecycleEvent: { id: "evt_one", createdAt: 100 },
      version: 3,
    });
    await service.act("user_one", "subscription_acq_one", { type: "cancel", mode: "immediate" });
    await service.act("user_one", "subscription_acq_one", { type: "cancel", mode: "immediate" });
    expect(provider.cancelSubscription).toHaveBeenCalledTimes(2);
    expect(provider.cancelSubscription.mock.calls[0][0].idempotencyKey)
      .toBe(provider.cancelSubscription.mock.calls[1][0].idempotencyKey);
  });

  it("owner-scopes actions and skips already-applied provider mutations", async () => {
    const { service, repository, provider } = mocks();
    await expect(service.act("user_one", "subscription_missing", { type: "pause" }))
      .rejects.toBeInstanceOf(SubscriptionNotFoundError);
    repository.findSubscriptionForOwner.mockResolvedValue({
      id: "subscription_acq_one", planId: "plan_one", customerId: "user_one",
      acquisitionId: "acq_one", stripeSubscriptionId: "sub_one", stripeCustomerId: "cus_one",
      quantity: 1, status: "active", consent: storedAcquisition().acquisition.consent,
      pauseCollection: { behavior: "void" }, cancelAtPeriodEnd: false,
      latestLifecycleEvent: { id: "evt_one", createdAt: 1 }, version: 2,
    });
    await service.act("user_one", "subscription_acq_one", { type: "pause" });
    expect(provider.pauseCollection).not.toHaveBeenCalled();
  });
});
