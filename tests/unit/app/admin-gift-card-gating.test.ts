import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  readHonorGuard: vi.fn(),
  balancesMayExist: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  readHonorGuard: mocks.readHonorGuard,
  balancesMayExist: mocks.balancesMayExist,
}));
vi.mock("@/components/admin/GiftCardQueue", () => ({
  default: () => null,
}));

import AdminGiftCardsPage from "@/app/admin/gift-cards/page";
import GiftCardHonorBanner from "@/components/admin/GiftCardHonorBanner";

const RECORD = { outstanding_minor: 500, currency: "USD", open_reservations: 1, measured_at: 1_700_000_000 };

function render() {
  return AdminGiftCardsPage();
}

/** Walks the returned element tree for GiftCardHonorBanner's own props (identity match on type). */
function findBannerProps(node: unknown): Record<string, unknown> | undefined {
  if (node == null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findBannerProps(child);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === GiftCardHonorBanner) return element.props;
  if (element.props?.children) return findBannerProps(element.props.children);
  return undefined;
}

beforeEach(() => {
  mocks.context.mockResolvedValue({ env: { DB: {} } });
  mocks.readHonorGuard.mockResolvedValue(RECORD);
  mocks.balancesMayExist.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin gift-card page gating (D-17)", () => {
  it("throws NEXT_NOT_FOUND when both flags are off and the honor guard is clear", async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.balancesMayExist.mockReturnValue(false);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders with the banner wired to the guard record when honoring is off and the guard is active", async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.balancesMayExist.mockReturnValue(true);
    const tree = await render();
    const bannerProps = findBannerProps(tree);
    expect(bannerProps).toEqual({ record: RECORD, honorConfigured: false });
  });

  it("resolves without throwing and passes honorConfigured=true (no banner content) when honoring is on", async () => {
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: "true" } });
    const tree = await render();
    const bannerProps = findBannerProps(tree);
    expect(bannerProps).toMatchObject({ honorConfigured: true });
    expect(mocks.readHonorGuard).not.toHaveBeenCalled();
  });

  it("gates the sidebar entry by both feature booleans and its href (source contract)", () => {
    const sidebarSource = readFileSync(join(process.cwd(), "components/admin/AdminSidebar.tsx"), "utf8");
    const filterMatch = sidebarSource.match(/const visibleNavItems[\s\S]*?\}\);/);
    expect(filterMatch).not.toBeNull();
    const filterBody = filterMatch ? filterMatch[0] : "";
    expect(filterBody).toContain("/admin/gift-cards");
    expect(filterBody).toContain("giftCardAcquisition");
    expect(filterBody).toContain("giftCardReconciliation");
  });
});
