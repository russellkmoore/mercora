import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  resolveHonorEffective: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
// D-16: the detail page must ask the same owner the list page and the
// detail/events routes already ask — never re-derive the decision.
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));
vi.mock("@/components/admin/gift-cards/GiftCardDetail", () => ({
  default: () => null,
}));

import AdminGiftCardDetailPage from "@/app/admin/gift-cards/[id]/page";

function render(id = "gift_card_1") {
  return AdminGiftCardDetailPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  mocks.context.mockResolvedValue({ env: { DB: {} } });
  mocks.resolveHonorEffective.mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin gift-card detail page gating (D-16)", () => {
  it("throws NEXT_NOT_FOUND when both flags are off and the honor guard is clear", async () => {
    mocks.resolveHonorEffective.mockResolvedValue(false);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders when both flags are off and the honor guard is active", async () => {
    mocks.resolveHonorEffective.mockResolvedValue(true);
    await expect(render()).resolves.toBeDefined();
  });

  it("renders without consulting the guard when selling is on", async () => {
    mocks.context.mockResolvedValue({
      env: { DB: {}, STORE_FEATURE_GIFT_CARD_ACQUISITION: "true" },
    });
    await expect(render()).resolves.toBeDefined();
  });

  it("renders without consulting the guard when honoring is on", async () => {
    mocks.context.mockResolvedValue({
      env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: "true" },
    });
    await expect(render()).resolves.toBeDefined();
  });

  it("contains a direct call to resolveHonorEffective, with both flags rather than a bare boolean", async () => {
    mocks.resolveHonorEffective.mockResolvedValue(true);
    await render();
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      expect.anything(),
      { giftCardAcquisition: false, giftCardReconciliation: false },
      expect.any(Number),
    );
  });
});
