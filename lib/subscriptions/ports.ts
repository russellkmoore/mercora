import type { Order } from "@/lib/types/order";
import type {
  LifecycleEventCursor,
  SubscriptionAcquisition,
  SubscriptionLifecycleSnapshot,
  SubscriptionPlanBinding,
  ProviderAcquisitionRequest,
  ProviderSubscriptionBinding,
  VerifiedSubscriptionInvoice,
} from "./domain";

/** Narrow persistence contract; implementations must make each method atomic. */
export interface SubscriptionRepository {
  findProviderCustomer(customerId: string): Promise<{
    customerId: string;
    stripeCustomerId: string;
  } | undefined>;
  bindProviderCustomer(args: {
    customerId: string;
    stripeCustomerId: string;
  }): Promise<"created" | "identical" | "conflict">;
  findActivePlan(args: {
    productId: string;
    variantId: string;
    currency: string;
    stripePriceId: string;
    cadenceUnit: SubscriptionPlanBinding["cadence"]["unit"];
    cadenceCount: number;
  }): Promise<SubscriptionPlanBinding | undefined>;
  findAcquisitionBySetupIntent(setupIntentId: string): Promise<{
    acquisition: SubscriptionAcquisition;
    status: "pending" | "provider_created" | "completed" | "failed";
    stripeSubscriptionId?: string;
  } | undefined>;
  reserveAcquisition(acquisition: SubscriptionAcquisition): Promise<{
    acquisition: SubscriptionAcquisition;
    created: boolean;
  }>;
  recordProviderCreated(args: {
    acquisition: SubscriptionAcquisition;
    provider: ProviderSubscriptionBinding;
  }): Promise<"updated" | "already_recorded" | "conflict">;
  completeAcquisitionFromLifecycleWebhook(args: {
    acquisition: SubscriptionAcquisition;
    provider: ProviderSubscriptionBinding;
    lifecycle: SubscriptionLifecycleSnapshot;
    lifecycleEvent: LifecycleEventCursor;
  }): Promise<{ id: string; created: boolean }>;
  compareAndApplyLifecycle(args: {
    subscriptionId: string;
    expected: LifecycleEventCursor;
    incoming: LifecycleEventCursor;
    snapshot: SubscriptionLifecycleSnapshot;
  }): Promise<"applied" | "already_applied" | "conflict">;
  recordVerifiedInvoiceOrder(args: {
    subscriptionId: string;
    order: Order;
    invoice: VerifiedSubscriptionInvoice;
  }): Promise<{ orderId: string; created: boolean }>;
}

/** Stripe operations stay behind this injected port and are never imported by core checkout. */
export interface SubscriptionProvider {
  createSubscription(args: ProviderAcquisitionRequest): Promise<ProviderSubscriptionBinding>;
  /** Authoritative refresh returns state only; the signed event remains the cursor authority. */
  retrieveLifecycle(stripeSubscriptionId: string): Promise<SubscriptionLifecycleSnapshot>;
}
