import { and, eq, isNull, sql } from 'drizzle-orm';
import type { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import {
  MAX_REFUND_RECORDS,
  type RefundRecord,
} from '@/lib/utils/refund-validation';

type Db = Awaited<ReturnType<typeof getDbAsync>>;
export type RefundOrderRow = typeof orders.$inferSelect;
export const MAX_REFUND_CAS_ATTEMPTS = 5;

export interface RefundLedgerContext {
  order: RefundOrderRow;
  extensions: Record<string, unknown>;
  refunds: RefundRecord[];
  version: number;
  nextVersion: number;
  nowIso: string;
}

export type RefundLedgerMutation =
  | { action: 'skip' }
  | {
      action: 'write';
      extensions: Record<string, unknown>;
      columns?: Partial<Pick<RefundOrderRow, 'status' | 'payment_status' | 'notes'>>;
    };

export type RefundLedgerMutationResult =
  | { ok: true; skipped: boolean; order: RefundOrderRow }
  | { ok: false; reason: 'not_found' | 'invalid_ledger' | 'cas_exhausted' };

export function parseRefundExtensions(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (parsed == null) return {};
  return typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

export function readRefundsVersion(extensions: Record<string, unknown>): number | null {
  const value = extensions.refunds_version ?? 0;
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : null;
}

function updatedAtGuard(value: string | null) {
  return value === null ? isNull(orders.updated_at) : eq(orders.updated_at, value);
}

function refundsVersionGuard(version: number) {
  return sql`COALESCE(json_extract(${orders.extensions}, '$.refunds_version'), 0) = ${version}`;
}

/**
 * Run a bounded optimistic-concurrency update over the JSON refund ledger.
 * The callback may be retried and therefore must remain side-effect free.
 */
export async function mutateRefundLedger(
  db: Db,
  orderId: string,
  mutate: (context: RefundLedgerContext) => RefundLedgerMutation | Promise<RefundLedgerMutation>,
  options: { now?: () => Date; maxAttempts?: number } = {}
): Promise<RefundLedgerMutationResult> {
  const attempts = options.maxAttempts ?? MAX_REFUND_CAS_ATTEMPTS;
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10) {
    throw new Error('Refund ledger CAS attempts must be between 1 and 10');
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return { ok: false, reason: 'not_found' };

    const extensions = parseRefundExtensions(order.extensions);
    if (!extensions) return { ok: false, reason: 'invalid_ledger' };
    const rawRefunds = extensions.refunds ?? [];
    if (!Array.isArray(rawRefunds) || rawRefunds.length > MAX_REFUND_RECORDS) {
      return { ok: false, reason: 'invalid_ledger' };
    }
    const version = readRefundsVersion(extensions);
    if (version === null || version === Number.MAX_SAFE_INTEGER) {
      return { ok: false, reason: 'invalid_ledger' };
    }
    const nowIso = (options.now?.() ?? new Date()).toISOString();
    const decision = await mutate({
      order,
      extensions,
      refunds: rawRefunds as RefundRecord[],
      version,
      nextVersion: version + 1,
      nowIso,
    });
    if (decision.action === 'skip') {
      return { ok: true, skipped: true, order };
    }
    if (decision.extensions.refunds_version !== version + 1) {
      throw new Error('Refund ledger mutation must increment refunds_version exactly once');
    }

    const [updated] = await db.update(orders).set({
      ...(decision.columns ?? {}),
      extensions: decision.extensions,
      updated_at: nowIso,
    }).where(and(
      eq(orders.id, orderId),
      updatedAtGuard(order.updated_at ?? null),
      refundsVersionGuard(version)
    )).returning();
    if (updated) return { ok: true, skipped: false, order: updated };
  }

  return { ok: false, reason: 'cas_exhausted' };
}
