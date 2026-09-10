import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import { createGiftCardRepository } from "@/lib/gift-cards/repository";
import {
  HONOR_GUARD_MIXED_CURRENCY,
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

/**
 * Close out any committed-but-unsettled reservation left by a previous case.
 *
 * The suites below isolate cases by advancing the clock and disabling leftover
 * accounts. That is no longer enough: a committed reservation never expires,
 * and the measurement now counts one against a *disabled* card too (WR-14) —
 * deliberately, because that is still money. Releasing is not an option either;
 * `gift_card_reservations_transition_guard` refuses to release anything already
 * committed. Settling is the only way to close one, which is exactly what
 * production does, so that is what this does.
 */
async function settleStrandedReservations(): Promise<void> {
  const stranded = await env.DB.prepare(
    `SELECT id, committed_order_id FROM gift_card_reservations
     WHERE released_at IS NULL AND committed_at IS NOT NULL
       AND committed_order_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM gift_card_ledger_entries entry
         WHERE entry.reservation_id = gift_card_reservations.id
           AND entry.entry_type = 'redemption'
       )`,
  ).all<{ id: string; committed_order_id: string }>();

  const repository = createGiftCardRepository(env.DB);
  for (const row of stranded.results ?? []) {
    await repository.settleReservation({
      reservationId: row.id,
      orderId: row.committed_order_id,
      settledAt: now,
    });
  }
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
    await settleStrandedReservations();
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
      held_minor: 0,
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
      held_minor: 0,
      measured_at: now,
    });
    expect(alarms).toEqual([]);
  });

  it("marks the currency mixed rather than formatting a cross-currency sum", async () => {
    // MIN(currency_code) used to name whichever code sorted first, so a store
    // holding USD and EUR cards got a number that is not a total of anything
    // formatted as if it were. The total still answers "is there money out
    // there", so it is kept; the currency is what becomes untrustworthy.
    await issueCardWorth(2_500);
    await createGiftCardRepository(env.DB).issueAccount({
      id: `${giftCardId}_eur`,
      codeHash: { keyVersion: 1, digest: (testSequence + 0x3000).toString(16).padStart(64, "0") },
      amount: Money.fromMinor(500, "EUR"),
      createdAt: now,
    });

    const { result } = await tick(true);

    expect(result.record.currency).toBe(HONOR_GUARD_MIXED_CURRENCY);
    expect(result.record.outstanding_minor).toBe(3_000);
    expect(result.honorEffective).toBe(true);
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
