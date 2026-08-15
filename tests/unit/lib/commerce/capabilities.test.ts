import { describe, expect, it, vi } from "vitest";
import { Money } from "@/lib/money";
import {
  CommerceCapabilityConfigurationError,
  noOpCommerceCapabilities,
  resolveCommerceCapabilities,
  SUBSCRIPTION_ACQUISITION_EXTENSION,
} from "@/lib/commerce/capabilities";
import type { Order } from "@/lib/types/order";

function paidOrder(extensions: Record<string, unknown> = {}): Order {
  return {
    id: "order_one",
    status: "processing",
    payment_status: "paid",
    total_amount: Money.fromMinor(2500, "USD").toJSON(),
    currency_code: "USD",
    items: [],
    extensions,
  };
}

describe("commerce capability resolution", () => {
  it("does not construct providers or touch feature dependencies while disabled", () => {
    const giftCards = vi.fn();
    const subscriptions = vi.fn();
    const resolved = resolveCommerceCapabilities(
      {
        giftCards: false,
        subscriptionAcquisition: false,
        subscriptionReconciliation: false,
      },
      { giftCards, subscriptions },
    );

    expect(resolved).toBeDefined();
    expect(giftCards).not.toHaveBeenCalled();
    expect(subscriptions).not.toHaveBeenCalled();
    expect(resolved.giftCards).toBe(noOpCommerceCapabilities.giftCards);
    expect(resolved.subscriptions).toBe(noOpCommerceCapabilities.subscriptions);
  });

  it("fails configuration instead of silently enabling an absent provider", () => {
    expect(() => resolveCommerceCapabilities({
      giftCards: false,
      subscriptionAcquisition: false,
      subscriptionReconciliation: true,
    })).toThrow(CommerceCapabilityConfigurationError);
  });

  it("lets ordinary paid orders converge while disabled", async () => {
    await expect(noOpCommerceCapabilities.subscriptions.orderPaid(paidOrder()))
      .resolves.toBeUndefined();
  });

  it("never silently succeeds for a marked subscription acquisition", async () => {
    await expect(noOpCommerceCapabilities.subscriptions.orderPaid(paidOrder({
      [SUBSCRIPTION_ACQUISITION_EXTENSION]: "acq_one",
    }))).rejects.toThrow("disabled");
  });

  it("keeps reconciliation installed when new acquisition is disabled", async () => {
    const subscriptionCapability = {
      orderPaid: vi.fn(async () => undefined),
    };
    const giftCards = vi.fn();
    const subscriptions = vi.fn(() => subscriptionCapability);
    const resolved = resolveCommerceCapabilities(
      {
        giftCards: false,
        subscriptionAcquisition: false,
        subscriptionReconciliation: true,
      },
      { giftCards, subscriptions },
    );

    expect(subscriptions).toHaveBeenCalledOnce();
    expect(giftCards).not.toHaveBeenCalled();
    await resolved.subscriptions.orderPaid(paidOrder());
    expect(subscriptionCapability.orderPaid).not.toHaveBeenCalled();
    const invoiceOrder = paidOrder({
      [SUBSCRIPTION_ACQUISITION_EXTENSION]: "acq_one",
    });
    await resolved.subscriptions.orderPaid(invoiceOrder);
    expect(subscriptionCapability.orderPaid).toHaveBeenCalledWith(invoiceOrder);
  });

  it("requires reconciliation before enabling new subscription sales", () => {
    expect(() => resolveCommerceCapabilities({
      giftCards: false,
      subscriptionAcquisition: true,
      subscriptionReconciliation: false,
    }, {
      subscriptions: () => ({ orderPaid: vi.fn() }),
    })).toThrow("requires lifecycle and invoice reconciliation");
  });
});
