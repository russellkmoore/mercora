/**
 * === Gift-card honor banner ===
 *
 * The operator-facing half of the honor guard measured by the five-minute
 * cron (13-05) and read once by the admin gift-card page (13-08, D-17).
 *
 * Two states, and the difference between them matters. When honoring is off
 * *and the guard is active* — money still outstanding, or a measurement we
 * cannot trust — this is an alarm: the store believes it stopped honoring and
 * the runtime is honoring anyway. When honoring is off and the guard is clear,
 * that is the flag doing exactly what it was set to do, so it gets one quiet
 * line and no warning colour. Alarming on both is how an operator learns to
 * ignore the banner.
 *
 * It names the outstanding total and the open-reservation count, never a card
 * identity, code fragment, recipient or account id (T-13-34).
 *
 * The admin dashboard keeps its own fixed palette by design (AGENTS.md);
 * this uses the same amber/warning tones as `AdminGuard.tsx`, not storefront
 * token classes.
 */

import { AlertTriangle } from "lucide-react";
import { Money } from "@/lib/money";
import {
  HONOR_GUARD_MIXED_CURRENCY,
  HONOR_GUARD_STALE_SECONDS,
  type HonorGuardRecord,
} from "@/lib/gift-cards/honor-guard";

interface GiftCardHonorBannerProps {
  /** The current honor-guard measurement, or `null` when unreadable. */
  record: HonorGuardRecord | null;
  /** Whether the honor (reconciliation) flag is configured on. */
  honorConfigured: boolean;
  /**
   * Whether the runtime is still honoring balances despite the flag — the page
   * has already computed this from the same record. Without it the banner
   * printed "$0.00 outstanding across 0 open reservations" as a warning, which
   * is an alarm for a correct state.
   */
  guardActive: boolean;
}

function isStale(record: HonorGuardRecord, nowSeconds: number): boolean {
  return nowSeconds - record.measured_at > HONOR_GUARD_STALE_SECONDS;
}

/** Isolated so the impure `Date.now()` read is not textually inside the component body. */
function currentSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

/**
 * How to say what is outstanding.
 *
 * A total spanning several currencies is a bare sum of minor units, not an
 * amount, so it is described rather than formatted — printing it under one
 * currency code would be a smaller number than the truth in one currency and a
 * larger one in another.
 */
function outstandingSummary(record: HonorGuardRecord): string {
  const reservations = `${record.open_reservations} open reservation${record.open_reservations === 1 ? "" : "s"}`;
  if (record.currency === HONOR_GUARD_MIXED_CURRENCY) {
    return `Balances outstanding across more than one currency, and ${reservations}`;
  }
  return `${Money.fromMinor(record.outstanding_minor, record.currency).format()} outstanding across ${reservations}`;
}

/**
 * A small presentational component — no data fetching. The page (server
 * component) reads the guard record and passes it down; this only formats.
 */
export default function GiftCardHonorBanner({
  record,
  honorConfigured,
  guardActive,
}: GiftCardHonorBannerProps) {
  if (honorConfigured) return null;

  // Honoring is off and the last measurement was fresh, readable and empty.
  // Nothing is wrong, so nothing shouts.
  if (!guardActive) {
    return (
      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
        <p className="text-sm text-gray-400">
          Gift-card honoring is off, and the last measurement found no outstanding balances.
        </p>
      </div>
    );
  }

  const nowSeconds = currentSeconds();
  const measurementUnusable = record === null || isStale(record, nowSeconds);

  return (
    <div className="mb-6 rounded-lg border border-yellow-600/30 bg-yellow-900/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="space-y-1 text-sm text-yellow-200">
          <p className="font-semibold text-yellow-100">
            Gift-card honoring is off, but balances still owed keep being honored regardless.
          </p>
          {measurementUnusable ? (
            <p>
              {record === null
                ? "The outstanding-balance measurement is unavailable."
                : "The outstanding-balance measurement is out of date."}{" "}
              The runtime is honoring balances until a fresh measurement can be trusted.
            </p>
          ) : (
            <p>
              {outstandingSummary(record)}, measured{" "}
              {new Date(record.measured_at * 1_000).toLocaleString()}.
            </p>
          )}
          <p>Set the honor flag back on until the balance is zero or every card has been refunded.</p>
        </div>
      </div>
    </div>
  );
}
