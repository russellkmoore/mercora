import { describe, expect, it } from "vitest";
import {
  HONOR_GUARD_SETTING_CATEGORY,
  HONOR_GUARD_SETTING_KEY,
  HONOR_GUARD_STALE_SECONDS,
  balancesMayExist,
  type HonorGuardRecord,
} from "@/lib/gift-cards/honor-guard";

const now = 1_800_000_000;

function record(overrides: Partial<HonorGuardRecord> = {}): HonorGuardRecord {
  return {
    outstanding_minor: 0,
    currency: "USD",
    open_reservations: 0,
    measured_at: now - 60,
    ...overrides,
  };
}

describe("honor-guard constants", () => {
  it("pins the settings key, category and staleness window", () => {
    expect(HONOR_GUARD_SETTING_KEY).toBe("gift_cards.honor_guard");
    expect(HONOR_GUARD_SETTING_CATEGORY).toBe("gift_cards");
    // Three missed five-minute cron ticks.
    expect(HONOR_GUARD_STALE_SECONDS).toBe(900);
  });
});

describe("balancesMayExist", () => {
  // Every row is read as "could there still be money out there?". The answer
  // has to be true whenever we do not have a fresh, readable zero (D-04).
  const cases: Array<{ name: string; record: HonorGuardRecord | null; expected: boolean }> = [
    {
      name: "no record at all — nothing has measured, so assume money is out there",
      record: null,
      expected: true,
    },
    {
      name: "a fresh record with nothing outstanding and nothing reserved",
      record: record(),
      expected: false,
    },
    {
      name: "a fresh record with a single minor unit outstanding",
      record: record({ outstanding_minor: 1 }),
      expected: true,
    },
    {
      name: "a fresh record with no balance but one open reservation",
      record: record({ open_reservations: 1 }),
      expected: true,
    },
    {
      name: "a zeroed record measured 901 seconds ago is stale",
      record: record({ measured_at: now - 901 }),
      expected: true,
    },
    {
      name: "a zeroed record measured exactly 900 seconds ago is still fresh",
      record: record({ measured_at: now - 900 }),
      expected: false,
    },
    {
      name: "a record whose outstanding total is not a number is unreadable",
      record: record({ outstanding_minor: "0" as unknown as number }),
      expected: true,
    },
    {
      name: "a record whose open-reservation count is not a number is unreadable",
      record: record({ open_reservations: Number.NaN }),
      expected: true,
    },
    {
      name: "a record whose measured_at is not a number is unreadable",
      record: record({ measured_at: null as unknown as number }),
      expected: true,
    },
    {
      name: "a record measured in the future is not treated as stale",
      record: record({ measured_at: now + 30 }),
      expected: false,
    },
    {
      name: "a negative outstanding total is not read as a positive balance",
      record: record({ outstanding_minor: -5 }),
      expected: false,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(balancesMayExist(testCase.record, now)).toBe(testCase.expected);
    });
  }
});
