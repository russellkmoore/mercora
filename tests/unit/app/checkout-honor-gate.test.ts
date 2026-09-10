import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-10 and D-18: with both gift-card flags off, gift cards do not exist for a
 * visitor — no listing entry, no product page, no balance endpoint, and no
 * checkout panel. Whether balances are still being honored server-side is a
 * separate, money decision (D-04), and it must not widen a public surface.
 *
 * The bug this pins: the page resolved the guard *before* applying that gate,
 * and every "we do not know" answer inside the guard is "keep honoring". So the
 * redemption panel appeared for the first five minutes after any deploy, across
 * any cron gap over 900 seconds, on any D1 read failure, and permanently on a
 * deploy that had not applied the gift-card migrations — a state the deployment
 * docs describe as supported.
 */

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  resolveHonorEffective: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.getCloudflareContext }));
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));
vi.mock("./CheckoutPageClient", () => ({ default: () => null }));

import CheckoutPage from "@/app/checkout/page";
import CheckoutPageClient from "@/app/checkout/CheckoutPageClient";

const DB = { prepare: vi.fn() };

function environment(flags: { sell?: string; honor?: string }, withDb = true) {
  mocks.getCloudflareContext.mockResolvedValue({
    env: {
      ...(withDb ? { DB } : {}),
      ...(flags.sell === undefined ? {} : { STORE_FEATURE_GIFT_CARD_ACQUISITION: flags.sell }),
      ...(flags.honor === undefined ? {} : { STORE_FEATURE_GIFT_CARD_RECONCILIATION: flags.honor }),
    },
  });
}

/** Walks the returned tree for the client boundary's props. */
function clientProps(node: unknown): Record<string, unknown> | undefined {
  if (node == null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = clientProps(child);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === CheckoutPageClient) return element.props;
  if (element.props?.children) return clientProps(element.props.children);
  return undefined;
}

async function honorEffective(): Promise<unknown> {
  return clientProps(await CheckoutPage())?.honorEffective;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The guard's own fail-open answer. Every case below that expects `false`
  // expects it *despite* this, which is the whole point.
  mocks.resolveHonorEffective.mockResolvedValue(true);
});

describe("checkout hides the redemption panel with both flags off (CR-05, D-10, D-18)", () => {
  it.each([
    ["both flags absent, as on a store that never enabled gift cards", {}],
    ["both flags explicitly false", { sell: "false", honor: "false" }],
  ])("resolves honorEffective to false when %s", async (_name, flags) => {
    environment(flags);

    await expect(honorEffective()).resolves.toBe(false);
    // The gate is presentation, decided before any money question is asked.
    expect(mocks.resolveHonorEffective).not.toHaveBeenCalled();
  });

  it("stays false with both flags off even when the guard says balances exist", async () => {
    // The exact state the guard exists for. Honoring keeps running server-side;
    // the shopper is simply offered no input for a card the store says does not
    // exist.
    environment({ sell: "false", honor: "false" });
    mocks.resolveHonorEffective.mockResolvedValue(true);

    await expect(honorEffective()).resolves.toBe(false);
  });

  it("stays false with both flags off and no database binding", async () => {
    // Nothing to read the guard from is the strongest "we do not know" there
    // is, and it used to render the panel.
    environment({ sell: "false", honor: "false" }, false);

    await expect(honorEffective()).resolves.toBe(false);
  });
});

describe("checkout still asks the money question when a gift-card surface exists", () => {
  it("delegates to resolveHonorEffective with sell off and honor on", async () => {
    environment({ sell: "false", honor: "true" });

    await expect(honorEffective()).resolves.toBe(true);
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      DB,
      { giftCardAcquisition: false, giftCardReconciliation: true },
      expect.any(Number),
    );
  });

  it("follows the decision rather than re-deriving one when selling is on", async () => {
    environment({ sell: "true", honor: "false" });
    mocks.resolveHonorEffective.mockResolvedValue(false);

    await expect(honorEffective()).resolves.toBe(false);
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      DB,
      { giftCardAcquisition: true, giftCardReconciliation: false },
      expect.any(Number),
    );
  });

  it("fails open when resolving the environment throws outright", async () => {
    // Showing an input the server would have accepted is the correct failure;
    // hiding one it would have accepted is not.
    mocks.getCloudflareContext.mockRejectedValue(new Error("no cloudflare context"));

    await expect(honorEffective()).resolves.toBe(true);
  });
});
