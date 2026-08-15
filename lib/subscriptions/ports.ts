import type { Order } from "@/lib/types/order";
import type {
  LifecycleEventCursor,
  SubscriptionAcquisition,
  SubscriptionLifecycleSnapshot,
  SubscriptionPlanBinding,
  ProviderAcquisitionRequest,
} from "./domain";

/** Narrow persistence contract; implementations must make each method atomic. */
export interface SubscriptionRepository {
  findActivePlan(args: {
    productId: string;
    variantId: string;
    currency: string;
    stripePriceId: string;
    cadenceUnit: SubscriptionPlanBinding["cadence"]["unit"];
    cadenceCount: number;
  }): Promise<SubscriptionPlanBinding | undefined>;
  findAcquisitionBySetupIntent(setupIntentId: string): Promise<{
    id: string;
    status: "pending" | "provider_created" | "completed" | "failed";
    stripeSubscriptionId?: string;
  } | undefined>;
  reserveAcquisition(acquisition: SubscriptionAcquisition): Promise<{
    id: string;
    created: boolean;
  }>;
  recordProviderCreated(args: {
    acquisitionId: string;
    stripeSubscriptionId: string;
  }): Promise<"updated" | "already_recorded" | "conflict">;
  completeAcquisitionFromLifecycleWebhook(args: {
    acquisitionId: string;
    stripeSubscriptionId: string;
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
    stripeInvoiceId: string;
    subscriptionId: string;
    order: Order;
    verifiedPaidAt: number;
  }): Promise<{ orderId: string; created: boolean }>;
}

/** Stripe operations stay behind this injected port and are never imported by core checkout. */
export interface SubscriptionProvider {
  createSubscription(args: ProviderAcquisitionRequest): Promise<{
    stripeSubscriptionId: string;
  }>;
  retrieveLifecycle(stripeSubscriptionId: string): Promise<{
    snapshot: SubscriptionLifecycleSnapshot;
    event: LifecycleEventCursor;
  }>;
}
