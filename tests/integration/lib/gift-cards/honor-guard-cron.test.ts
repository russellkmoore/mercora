import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import { createGiftCardRepository } from "@/lib/gift-cards/repository";
import {
  HONOR_GUARD_SETTING_KEY,
  readHonorGuard,
  runGiftCardHonorGuard,
} from "@/lib/gift-cards/honor-guard";

const epoch = 1_900_000_000;
let testSequence = 0;
let now = epoch;
let giftCardId = "gift_uninitialized";
let hash = "0".repeat(64);

/** Run one tick and return both its result and every critical envelope it logged. */
async function tick(configuredHonor: boolean) {
  const logged: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
  try {
    const result = await runGiftCardHonorGuard(env.DB, configuredHonor, now);
    return { result, alarms: logged.map((line) => JSON.parse(line) as { event: string; severity: string; fields?: Record<string, unknown> }) };
  } finally {
    spy.mockRestore();
  }
}

async function issueCardWorth(minor: number): Promise<void> {
  await createGiftCardRepository(env.DB).issueAccount({
    id: giftCardId,
    codeHash: { keyVersion: 1, digest: hash },
    amount: Money.fromMinor(minor, "USD"),
    createdAt: now,
  });
}

describe("runGiftCardHonorGuard on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  // Same isolation dance as the sibling aggregate suite: the ledger is
  // append-only and reservation identity immutable, so each case advances its
  // own clock a day and disables whatever the last case left active.
  beforeEach(async () => {
    testSequence += 1;
    now = epoch + testSequence * 86_400;
    giftCardId = `gift_cron_${testSequence}`;
    hash = (testSequence + 0x2000).toString(16).padStart(64, "0");
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE status = 'active'",
    ).bind(now).run();
  });

  it("measures the outstanding balance and stores it under the guard key", async () => {
    await issueCardWorth(2_500);

    const { result, alarms } = await tick(true);

    expect(result.honorEffective).toBe(true);
    expect(result.record).toEqual({
      outstanding_minor: 2_500,
      currency: "USD",
      open_reservations: 0,
      measured_at: now,
    });
    await expect(readHonorGuard(env.DB)).resolves.toEqual(result.record);
    // Honoring configured on is ordinary operation, not an alarm.
    expect(alarms).toEqual([]);
  });

  it("keeps honoring and pages on every tick while honoring is off with money outstanding", async () => {
    await issueCardWorth(2_500);

    const first = await tick(false);
    const second = await tick(false);

    expect(first.result.honorEffective).toBe(true);
    expect(second.result.honorEffective).toBe(true);
    // Every tick, not once: the alarm describes a state an operator has to
    // fix, so it must not go quiet after the first firing (D-05).
    for (const { alarms } of [first, second]) {
      expect(alarms).toHaveLength(1);
      expect(alarms[0]).toMatchObject({
        event: "gift_card.honor_disabled_with_balances",
        severity: "critical",
        fields: { effect_type: "gift_card", trigger: "scheduled", outcome: "needs_review" },
      });
    }
  });

  it("stops honoring and stays quiet once the measurement is fresh and empty", async () => {
    const { result, alarms } = await tick(false);

    expect(result.honorEffective).toBe(false);
    expect(result.record).toEqual({
      outstanding_minor: 0,
      // No active cards means the aggregate has no currency to report, so the
      // record falls back to the store's default.
      currency: "USD",
      open_reservations: 0,
      measured_at: now,
    });
    expect(alarms).toEqual([]);
  });

  it("writes the measurement under the fixed key rather than a second row", async () => {
    await issueCardWorth(700);
    await tick(true);
    await tick(true);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM admin_settings WHERE key = ?",
    ).bind(HONOR_GUARD_SETTING_KEY).first<{ total: number }>();
    expect(rows?.total).toBe(1);
  });
});
