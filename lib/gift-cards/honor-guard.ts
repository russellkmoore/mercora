/**
 * === Gift-card honor guard ===
 *
 * The one small row that decides whether honoring has to keep running even
 * though the honor flag is off (D-04, D-15).
 *
 * Three facts shape this module:
 *
 * 1. **Only the five-minute cron writes it.** `writeHonorGuard` exists for the
 *    scheduled handler and nothing else; no request path writes this record.
 *    A request-time writer would let a forged or racing measurement switch
 *    honoring off while cards still carry money.
 * 2. **Request-time code reads one row, never the balance query.** That is
 *    what D-06's "no per-request balance scan" means in practice. The
 *    aggregate SQL lives in `lib/gift-cards/repository.ts`
 *    (`sumOutstandingGiftCardBalances`) and is called only from the cron and
 *    the admin page; this module contains no aggregate of its own.
 * 3. **Missing, stale, malformed and unreadable all mean "balances may
 *    exist".** The failure direction always favours the shopper holding a
 *    card: the only way honoring turns off is a fresh, readable record that
 *    says zero. A corrupt row therefore returns `null` rather than throwing —
 *    taking down every request would be a worse answer than honoring a card
 *    the store meant to stop honoring.
 *
 * `runGiftCardHonorGuard` is the cron's entry point and the only writer of the
 * record. The five-minute scheduled tick calls it; nothing else does. It is the
 * one function here that runs the balance aggregate, which is why it must never
 * be reachable from a request path (D-05, D-06, D-15).
 */

import { sumOutstandingGiftCardBalances } from '@/lib/gift-cards/repository';
import { recordTelemetry, type TelemetryOptions } from '@/lib/observability/telemetry';

/** The `admin_settings` primary key this measurement lives under (D-15). */
export const HONOR_GUARD_SETTING_KEY = 'gift_cards.honor_guard';

/**
 * A new value for `admin_settings.category`. That column is free text with no
 * CHECK constraint, so this needs no migration.
 */
export const HONOR_GUARD_SETTING_CATEGORY = 'gift_cards';

/**
 * How old a measurement may be before we stop trusting it. The cron ticks
 * every five minutes, so this is a tolerance of three missed ticks — long
 * enough to ride out a deploy, short enough that a wedged cron cannot leave a
 * stale zero standing in for a real balance.
 */
export const HONOR_GUARD_STALE_SECONDS = 900;

/**
 * The measurement, exactly as D-15 fixes it. Four fields, no more: anything
 * else belongs in the aggregate the cron runs, not in the row every request
 * may read.
 */
export interface HonorGuardRecord {
  outstanding_minor: number;
  currency: string;
  open_reservations: number;
  measured_at: number;
}

/**
 * Recorded in place of a currency code when the active cards span more than
 * one currency.
 *
 * `outstandingMinor` is a bare SUM of minor units with no GROUP BY, so a store
 * holding both USD and EUR cards produces a number that is not a total of
 * anything. It is still a perfectly good answer to the only question this
 * record has to answer — is there money out there — so it is kept, and the
 * currency is replaced with a sentinel that cannot be mistaken for an ISO code.
 * The banner refuses to format a total marked this way rather than printing a
 * mixed sum under whichever code happened to sort first.
 */
export const HONOR_GUARD_MIXED_CURRENCY = 'MIXED';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A currency this record may carry: an ISO 4217 alphabetic code, or the mixed
 * sentinel. Anything else — an empty string, a two-letter code, a symbol — is a
 * value `Money` and `Intl.NumberFormat` throw on, and the banner formats these
 * straight into an admin server component.
 */
function isUsableCurrency(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value === HONOR_GUARD_MIXED_CURRENCY || /^[A-Z]{3}$/i.test(value);
}

/**
 * Validate hard enough that the banner can format what comes back.
 *
 * "Finite number" is not enough for a value that reaches
 * `Money.fromMinor(...).format()`: a fractional total trips
 * `assertSafeMinorUnits`, an empty-string currency throws `TypeError` in the
 * `Money` constructor, and a non-ISO code throws `RangeError` out of
 * `Intl.NumberFormat`. Each of those takes down the admin page an operator
 * opens precisely when something is wrong. `null` is a shape both
 * `balancesMayExist` and the banner already handle, and it fails toward
 * honoring, so it is the right answer for anything we cannot use.
 */
function parseRecord(raw: string): HonorGuardRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<Record<keyof HonorGuardRecord, unknown>>;
  if (
    !Number.isSafeInteger(candidate.outstanding_minor)
    || !Number.isSafeInteger(candidate.open_reservations)
    || (candidate.open_reservations as number) < 0
    || !isFiniteNumber(candidate.measured_at)
    || !isUsableCurrency(candidate.currency)
  ) return null;
  return {
    outstanding_minor: candidate.outstanding_minor as number,
    currency: candidate.currency,
    open_reservations: candidate.open_reservations as number,
    measured_at: candidate.measured_at,
  };
}

/**
 * Read the current measurement, or `null` when there is not a readable one.
 *
 * Raw `prepare` rather than the ORM settings helper: the callers that matter
 * (the scheduled handler, capability resolution) already hold a `D1Database`
 * binding and have no request-scoped ORM instance to reach for.
 *
 * A missing row, malformed JSON and a well-formed row of the wrong shape all
 * return `null` — every one of them means "we do not know", and `null` is how
 * `balancesMayExist` hears that.
 */
export async function readHonorGuard(database: D1Database): Promise<HonorGuardRecord | null> {
  const setting = await database.prepare(
    'SELECT value FROM admin_settings WHERE key = ?',
  ).bind(HONOR_GUARD_SETTING_KEY).first<{ value: string }>();
  if (!setting || typeof setting.value !== 'string') return null;
  return parseRecord(setting.value);
}

/**
 * Write the measurement. The five-minute cron is the only caller (D-15); a
 * source-contract test in plan 13-08 asserts no file under `app/` imports it.
 *
 * Upsert on the primary key so a tick never fails on the row it wrote last
 * time.
 */
export async function writeHonorGuard(
  database: D1Database,
  record: HonorGuardRecord,
): Promise<void> {
  await database.prepare(
    `INSERT INTO admin_settings (key, value, category, description, data_type)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       category = excluded.category,
       description = excluded.description,
       data_type = excluded.data_type,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    HONOR_GUARD_SETTING_KEY,
    JSON.stringify(record),
    HONOR_GUARD_SETTING_CATEGORY,
    'Outstanding gift-card balance measured by the scheduled honor guard',
    'object',
  ).run();
}

/**
 * Page on-call: the honor flag is off and there is still money on cards.
 *
 * The five-minute cron calls this every tick the condition holds (D-05), so
 * the alarm keeps sounding rather than firing once and going quiet. The event
 * is registered critical at sample rate 1, so it is never sampled away.
 *
 * Only fields already in the closed taxonomy are used. The stranded total
 * itself is not one of them — it lives in the guard record and on the admin
 * banner, which is where an operator acts on it.
 */
export function reportHonorDisabledWithBalances(
  record: HonorGuardRecord,
  options: TelemetryOptions = {},
): void {
  recordTelemetry('gift_card.honor_disabled_with_balances', {
    effect_type: 'gift_card',
    trigger: 'scheduled',
    outcome: 'needs_review',
    count: record.open_reservations,
  }, undefined, options);
}

/**
 * Could there still be gift-card money out there?
 *
 * True unless we hold a fresh, readable record that says zero on both counts.
 * Note that a record measured in the future is not stale — a clock that ran
 * ahead is not a reason to distrust the number.
 *
 * "Says zero" means exactly zero, not "not positive". A negative total can only
 * come from ledger corruption or a forged record, and neither is a reason to
 * believe the store owes nobody anything — the stated rule is that the only way
 * honoring turns off is a fresh, readable record that says zero, and a negative
 * number is not zero. That case is logged, which is the one bit of I/O here: a
 * silently impossible number is how a real accounting bug stays invisible.
 */
export function balancesMayExist(
  record: HonorGuardRecord | null,
  nowSeconds: number,
): boolean {
  if (record === null) return true;
  if (
    !isFiniteNumber(record.outstanding_minor)
    || !isFiniteNumber(record.open_reservations)
    || !isFiniteNumber(record.measured_at)
  ) return true;
  if (nowSeconds - record.measured_at > HONOR_GUARD_STALE_SECONDS) return true;
  if (record.outstanding_minor < 0 || record.open_reservations < 0) {
    console.warn(
      '[gift-cards] honor guard measured a negative outstanding balance; keeping honoring on',
      JSON.stringify({
        outstanding_minor: record.outstanding_minor,
        open_reservations: record.open_reservations,
        measured_at: record.measured_at,
      }),
    );
    return true;
  }
  return record.outstanding_minor !== 0 || record.open_reservations !== 0;
}

/**
 * Whether honoring must run right now, whatever the flag says.
 *
 * With honor configured on the answer is yes and D1 is never touched — the
 * guard is a reason to keep honoring, never a reason to stop. With honor
 * configured off, one row decides it, and any failure reading that row is
 * answered "keep honoring" (D-04).
 */
export async function honorIsEffectivelyOn(
  database: D1Database,
  configuredHonor: boolean,
  nowSeconds: number,
): Promise<boolean> {
  if (configuredHonor) return true;
  try {
    return balancesMayExist(await readHonorGuard(database), nowSeconds);
  } catch {
    return true;
  }
}

/**
 * The store's default currency (`storeDefaults.commerce.currency`), used only
 * when there are no active cards at all and the aggregate has no currency to
 * report. Held locally rather than imported so this module — which capability
 * resolution loads on the request path — stays free of the store-config graph.
 */
const HONOR_GUARD_DEFAULT_CURRENCY = 'USD';


/**
 * One five-minute tick of the honor guard: measure, store, decide, and page.
 *
 * Called only from the scheduled handler. It is the sole writer of the guard
 * record and the only place the balance aggregate runs on a schedule (D-05).
 *
 * The alarm fires on every tick the condition holds rather than once, because
 * "honor is off and shoppers still hold money" is a state an operator must fix,
 * not an event they can acknowledge away.
 */
export async function runGiftCardHonorGuard(
  database: D1Database,
  configuredHonor: boolean,
  nowSeconds: number,
): Promise<{ honorEffective: boolean; record: HonorGuardRecord }> {
  const balances = await sumOutstandingGiftCardBalances(database, nowSeconds);
  const record: HonorGuardRecord = {
    outstanding_minor: balances.outstandingMinor,
    currency: balances.currencyCount > 1
      ? HONOR_GUARD_MIXED_CURRENCY
      : balances.currency ?? HONOR_GUARD_DEFAULT_CURRENCY,
    open_reservations: balances.openReservations,
    measured_at: nowSeconds,
  };
  await writeHonorGuard(database, record);
  const honorEffective = configuredHonor || balancesMayExist(record, nowSeconds);
  // Only the configured-off-but-still-honoring state is an alarm. Honor
  // configured on is ordinary operation, and a fresh zeroed record under
  // honor off is the flag doing exactly what it was set to do.
  if (!configuredHonor && honorEffective) reportHonorDisabledWithBalances(record);
  return { honorEffective, record };
}
