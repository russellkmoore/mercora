import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@/lib/db/schema';
import { decideRefundLedgerAction } from '@/lib/payments/refund-ledger';
import { mutateRefundLedger, parseRefundExtensions } from '@/lib/payments/refund-ledger-store';
import { applyTestMigrations } from '../../helpers/d1';

const db = drizzle(env.DB, { schema });
const orderId = 'U09-REFUND-CAS';
const now = new Date('2026-08-05T22:00:00.000Z');

async function insertOrder(extensions: Record<string, unknown> = {}): Promise<void> {
  await env.DB.prepare(`
INSERT INTO orders (
  id, status, total_amount, currency_code, items, payment_status,
  external_references, extensions, created_at, updated_at
) VALUES (?, 'processing', ?, 'USD', '[]', 'paid', ?, ?, ?, ?)
`).bind(
    orderId,
    JSON.stringify({ amount: 1_000, currency: 'USD' }),
    JSON.stringify({ payment_intent_id: 'pi_refund' }),
    JSON.stringify({ payment_intent_id: 'pi_refund', ...extensions }),
    now.toISOString(),
    now.toISOString()
  ).run();
}

async function storedExtensions(): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare('SELECT extensions FROM orders WHERE id = ?')
    .bind(orderId).first<{ extensions: string }>();
  return parseRefundExtensions(row?.extensions) ?? {};
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run();
});

describe('refund ledger CAS in real D1', () => {
  it('preserves two non-conflicting writes that race at the same timestamp', async () => {
    await insertOrder({ refunds: [], refunds_version: 0 });
    const append = (id: string) => mutateRefundLedger(db, orderId, (context) => ({
      action: 'write',
      extensions: {
        ...context.extensions,
        refunds: [...context.refunds, { id, amount: 100, status: 'succeeded' }],
        refunds_version: context.nextVersion,
      },
    }), { now: () => now });

    const results = await Promise.all([append('refund-a'), append('refund-b')]);
    expect(results.every((result) => result.ok)).toBe(true);
    const extensions = await storedExtensions();
    expect(extensions.refunds_version).toBe(2);
    expect((extensions.refunds as Array<{ id: string }>).map((entry) => entry.id).sort())
      .toEqual(['refund-a', 'refund-b']);
  });

  it('allows only one concurrent reservation to consume limited balance', async () => {
    await insertOrder({ refunds: [], refunds_version: 0 });
    const reserve = (lineId: string) => mutateRefundLedger(db, orderId, async (context) => {
      const decision = await decideRefundLedgerAction(context.refunds, {
        orderId,
        type: 'partial',
        amount: 600,
        lineIds: [lineId],
        totalAmount: 1_000,
      });
      if (decision.action !== 'reserve') return { action: 'skip' as const };
      return {
        action: 'write' as const,
        extensions: {
          ...context.extensions,
          refunds: [...context.refunds, {
            id: decision.idempotencyKey,
            idempotency_key: decision.idempotencyKey,
            amount: decision.refundAmount,
            status: 'pending',
          }],
          refunds_version: context.nextVersion,
        },
      };
    }, { now: () => now });

    await Promise.all([reserve('line-a'), reserve('line-b')]);
    const extensions = await storedExtensions();
    expect(extensions.refunds_version).toBe(1);
    expect(extensions.refunds).toHaveLength(1);
  });

  it('fails closed on a corrupt monotonic version', async () => {
    await insertOrder({ refunds: [], refunds_version: 'invalid' });
    await expect(mutateRefundLedger(db, orderId, () => ({ action: 'skip' })))
      .resolves.toEqual({ ok: false, reason: 'invalid_ledger' });
  });
});
