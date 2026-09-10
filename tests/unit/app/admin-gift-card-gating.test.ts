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
  resolveHonorEffective: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
// The page reads the record for *display* and asks `resolveHonorEffective` for
// the decision (D-18). Both are stubbed here; both are collaborators.
vi.mock("@/lib/gift-cards/honor-guard", () => ({
  readHonorGuard: mocks.readHonorGuard,
  resolveHonorEffective: mocks.resolveHonorEffective,
  HONOR_GUARD_STALE_SECONDS: 900,
  HONOR_GUARD_MIXED_CURRENCY: "MIXED",
}));
vi.mock("@/components/admin/GiftCardQueue", () => ({
  default: () => null,
}));

import AdminGiftCardsPage from "@/app/admin/gift-cards/page";
import GiftCardHonorBanner from "@/components/admin/GiftCardHonorBanner";

// measured_at is relative to the real clock (not mocked here) so the banner-content
// tests below see a fresh record — GiftCardHonorBanner computes staleness with the
// real Date.now(), independent of the page-level honor-guard mocks.
const RECORD = {
  outstanding_minor: 500,
  currency: "USD",
  open_reservations: 1,
  measured_at: Math.floor(Date.now() / 1_000) - 120,
};

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
  mocks.resolveHonorEffective.mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin gift-card page gating (D-17)", () => {
  it("throws NEXT_NOT_FOUND when both flags are off and the honor guard is clear", async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(false);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders with the banner wired to the guard record when honoring is off and the guard is active", async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(true);
    const tree = await render();
    const bannerProps = findBannerProps(tree);
    expect(bannerProps).toEqual({ record: RECORD, honorConfigured: false, guardActive: true });
  });

  it("degrades to a null record instead of 500ing when the guard read throws (WR-03)", async () => {
    // This is the page an operator opens when gift-card money is already in a
    // state they need to see, and an uncaught D1 error here is a 500 on exactly
    // that page. `/api/admin/gift-cards` already swallows the same error.
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.readHonorGuard.mockRejectedValue(new Error("D1_ERROR: no such table"));
    mocks.resolveHonorEffective.mockResolvedValue(true);

    const tree = await render();

    expect(findBannerProps(tree)).toEqual({
      record: null,
      honorConfigured: false,
      guardActive: true,
    });
    // The read was attempted and its failure absorbed — `null` is the shape the
    // banner reads as "measurement unavailable". The decision beside it comes
    // from `resolveHonorEffective`, which fails toward honoring on its own.
    expect(mocks.readHonorGuard).toHaveBeenCalled();
    expect(mocks.resolveHonorEffective).toHaveBeenCalled();
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

/** Collects the text content of a returned React element tree, without a DOM. */
function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const element = node as { props?: { children?: unknown } };
  if (element.props && "children" in element.props) return textOf(element.props.children);
  return "";
}

describe("GiftCardHonorBanner content (D-05, GCF-02)", () => {
  it("names the outstanding total, the open-reservation count and the measurement time", () => {
    const text = textOf(GiftCardHonorBanner({ record: RECORD, honorConfigured: false, guardActive: true }));
    expect(text).toContain(new Intl.NumberFormat("en-US", { style: "currency", currency: RECORD.currency }).format(5));
    expect(text).toContain("1 open reservation");
    expect(text).toContain(new Date(RECORD.measured_at * 1_000).toLocaleString());
  });

  it("renders nothing when honoring is configured on", () => {
    expect(GiftCardHonorBanner({ record: RECORD, honorConfigured: true, guardActive: false })).toBeNull();
  });

  it("says the measurement is unavailable, without printing a misleading zero, when the record is missing", () => {
    const text = textOf(GiftCardHonorBanner({ record: null, honorConfigured: false, guardActive: true }));
    expect(text).toContain("unavailable");
    expect(text).not.toMatch(/\$0\.00/);
  });

  it("says the measurement is out of date when the record is stale", () => {
    const stale = { ...RECORD, measured_at: 0 };
    const text = textOf(GiftCardHonorBanner({ record: stale, honorConfigured: false, guardActive: true }));
    expect(text).toContain("out of date");
  });

  it("names no card identity, code, hash, ciphertext, nonce or recipient", () => {
    const text = textOf(GiftCardHonorBanner({ record: RECORD, honorConfigured: false, guardActive: true }));
    expect(text).not.toMatch(/code|hash|cipher|nonce|recipient|@/i);
  });
});

describe("GiftCardHonorBanner does not alarm on a state that is working (WR-04)", () => {
  const clear = { ...RECORD, outstanding_minor: 0, open_reservations: 0 };

  it("says one quiet line, with no warning, when honoring is off and the guard is clear", () => {
    // The old banner printed "$0.00 outstanding across 0 open reservations"
    // under a warning header whenever honoring was off. That is the flag doing
    // exactly what it was set to do, and alarming on it is how an operator
    // learns to ignore the banner.
    const rendered = GiftCardHonorBanner({ record: clear, honorConfigured: false, guardActive: false });
    const text = textOf(rendered);

    expect(text).toContain("no outstanding balances");
    expect(text).not.toContain("keep being honored regardless");
    expect(text).not.toMatch(/\$0\.00/);
    expect(JSON.stringify(rendered)).not.toMatch(/yellow|AlertTriangle/);
  });

  it("still alarms with the same clear record once the guard reports it active", () => {
    // Same record, opposite decision: the banner follows the page's guard
    // reading rather than re-deriving one of its own.
    const text = textOf(GiftCardHonorBanner({ record: clear, honorConfigured: false, guardActive: true }));
    expect(text).toContain("keep being honored regardless");
  });
});

describe("GiftCardHonorBanner never formats an untrusted total (WR-02, WR-06)", () => {
  it("describes a mixed-currency total instead of printing it under one code", () => {
    // A cross-currency sum of minor units is not an amount. Formatting it under
    // one code understates it in one currency and overstates it in another.
    const mixed = { ...RECORD, currency: "MIXED", outstanding_minor: 3_000 };
    const text = textOf(GiftCardHonorBanner({ record: mixed, honorConfigured: false, guardActive: true }));

    expect(text).toContain("more than one currency");
    expect(text).toContain("1 open reservation");
    expect(text).not.toMatch(/[$€£]/);
  });
});
