import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("gift-card action bar source contracts (D-17, D-22, D-12)", () => {
  const actionBarSource = readFileSync(
    join(process.cwd(), "components", "admin", "gift-cards", "GiftCardActionBar.tsx"),
    "utf8",
  );

  it("imports AlertDialog from the alert-dialog component and toast from sonner", () => {
    expect(actionBarSource).toContain('from "@/components/ui/alert-dialog"');
    expect(actionBarSource).toMatch(/import\s*\{\s*[^}]*\bAlertDialog\b[^}]*\}\s*from\s*"@\/components\/ui\/alert-dialog"/);
    expect(actionBarSource).toContain('import { toast } from "sonner"');
  });

  it("contains no window.confirm call", () => {
    expect(actionBarSource).not.toMatch(/window\.confirm/);
  });

  it("renders the reveal control conditionally on the settings flag from the detail response", () => {
    expect(actionBarSource).toContain("capabilities.codeRevealEnabled");
    expect(actionBarSource).toContain("canReveal &&");
  });
});

describe("reveal keeps the code on screen until the dialog closes (D-12, CR-02)", () => {
  const actionBarSource = readFileSync(
    join(process.cwd(), "components", "admin", "gift-cards", "GiftCardActionBar.tsx"),
    "utf8",
  );
  const detailSource = readFileSync(
    join(process.cwd(), "components", "admin", "gift-cards", "GiftCardDetail.tsx"),
    "utf8",
  );

  /** The body of `const {name} = async? (...) => { ... };` at two-space indent. */
  function functionBody(source: string, name: string): string {
    const match = source.match(new RegExp(
      String.raw`\n  const ${name} = (?:async )?\([^)]*\) => \{\n([\s\S]*?)\n  \};`,
    ));
    expect(match, `${name} must be defined as an arrow function in the component`).not.toBeNull();
    // Full-line comments are prose about the rule, not code that could break it.
    return match![1].split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");
  }

  it("does not call onChanged inside runReveal — the refresh would unmount the dialog before the code renders", () => {
    const body = functionBody(actionBarSource, "runReveal");
    expect(body).toContain("setRevealedCode(code)");
    expect(body).not.toContain("onChanged(");
  });

  it("refreshes the parent only when the reveal dialog closes, and clears the code on every close", () => {
    const closeReveal = functionBody(actionBarSource, "closeRevealDialog");
    expect(closeReveal).toContain("closeDialog()");
    expect(closeReveal).toContain("onChanged()");
    expect(functionBody(actionBarSource, "closeDialog")).toContain("setRevealedCode(null)");
    expect(actionBarSource).toMatch(/pending\?\.type === "reveal"[^\n]*closeRevealDialog\(\)/);
  });

  it("keeps the code in dialog-local state only — never in a prop, a store, or the URL", () => {
    expect(actionBarSource).toMatch(/useState<string \| null>\(null\)/);
    expect(actionBarSource).not.toMatch(/localStorage|sessionStorage|searchParams|revealedCode\s*=\s*props/);
  });

  it("shows the revealed code with a copy button inside the reveal dialog", () => {
    expect(actionBarSource).toMatch(/<code[^>]*>\{revealedCode\}<\/code>/);
    expect(actionBarSource).toContain("navigator.clipboard.writeText(revealedCode)");
  });

  it("only unmounts the action bar for the first load, not for a refresh", () => {
    expect(detailSource).toMatch(/if \(mode === "initial"\) setLoading\(true\); else setRefreshing\(true\);/);
    expect(detailSource).toContain('void load("initial")');
    expect(detailSource).toContain("onChanged={() => void load()}");
  });
});

describe("gift-card note form source contract (D-11, GCA-03)", () => {
  it("bounds the note textarea at 2000 characters", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "components", "admin", "gift-cards", "GiftCardDetail.tsx"),
      "utf8",
    );
    expect(detailSource).toContain("NOTE_MAX_LENGTH = 2_000");
    expect(detailSource).toMatch(/maxLength=\{NOTE_MAX_LENGTH\}/);
  });
});
