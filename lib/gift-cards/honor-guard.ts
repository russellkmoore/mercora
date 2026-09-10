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
 */

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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
    !isFiniteNumber(candidate.outstanding_minor)
    || !isFiniteNumber(candidate.open_reservations)
    || !isFiniteNumber(candidate.measured_at)
    || typeof candidate.currency !== 'string'
  ) return null;
  return {
    outstanding_minor: candidate.outstanding_minor,
    currency: candidate.currency,
    open_reservations: candidate.open_reservations,
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
 * Could there still be gift-card money out there? Pure, no I/O.
 *
 * True unless we hold a fresh, readable record that says zero on both counts.
 * Note that a record measured in the future is not stale — a clock that ran
 * ahead is not a reason to distrust the number.
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
  return record.outstanding_minor > 0 || record.open_reservations > 0;
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
