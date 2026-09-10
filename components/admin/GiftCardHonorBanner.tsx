/**
 * === Gift-card honor banner ===
 *
 * The operator-facing half of the honor guard measured by the five-minute
 * cron (13-05) and read once by the admin gift-card page (13-08, D-17).
 *
 * Renders nothing when honoring is configured on. When honoring is off, it
 * names the outstanding total and the open-reservation count so an operator
 * knows money is still being honored despite the flag — never a card
 * identity, code fragment, recipient or account id (T-13-34).
 *
 * The admin dashboard keeps its own fixed palette by design (AGENTS.md);
 * this uses the same amber/warning tones as `AdminGuard.tsx`, not storefront
 * token classes.
 */

import { AlertTriangle } from "lucide-react";
import { Money } from "@/lib/money";
import { HONOR_GUARD_STALE_SECONDS, type HonorGuardRecord } from "@/lib/gift-cards/honor-guard";

interface GiftCardHonorBannerProps {
  /** The current honor-guard measurement, or `null` when unreadable. */
  record: HonorGuardRecord | null;
  /** Whether the honor (reconciliation) flag is configured on. */
  honorConfigured: boolean;
}

function isStale(record: HonorGuardRecord, nowSeconds: number): boolean {
  return nowSeconds - record.measured_at > HONOR_GUARD_STALE_SECONDS;
}

/** Isolated so the impure `Date.now()` read is not textually inside the component body. */
function currentSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

/**
 * A small presentational component — no data fetching. The page (server
 * component) reads the guard record and passes it down; this only formats.
 */
export default function GiftCardHonorBanner({ record, honorConfigured }: GiftCardHonorBannerProps) {
  if (honorConfigured) return null;

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
              {Money.fromMinor(record.outstanding_minor, record.currency).format()} outstanding across{" "}
              {record.open_reservations} open reservation{record.open_reservations === 1 ? "" : "s"}, measured{" "}
              {new Date(record.measured_at * 1_000).toLocaleString()}.
            </p>
          )}
          <p>Set the honor flag back on until the balance is zero or every card has been refunded.</p>
        </div>
      </div>
    </div>
  );
}
