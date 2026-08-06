import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { SHIPMENT_NO_UNSETTLED_REFUNDS_SQL } from '@/lib/utils/refund-validation';
import { applyTestMigrations } from '../../helpers/d1';

async function insertOrder(id: string, extensions: string | null): Promise<void> {
  await env.DB.prepare(`
INSERT INTO orders (
  id, status, total_amount, currency_code, items, payment_status,
  extensions, created_at, updated_at
) VALUES (?, 'processing', ?, 'USD', '[]', 'paid', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`).bind(id, JSON.stringify({ amount: 100, currency: 'USD' }), extensions).run();
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM orders WHERE id LIKE 'U09-SHIP-%'").run();
});

describe('future shipment refund-hold SQL contract', () => {
  it('blocks reserved refunds without tripping on legacy JSON shapes', async () => {
    await insertOrder('U09-SHIP-ABSENT', null);
    await insertOrder('U09-SHIP-MALFORMED', '{malformed');
    await insertOrder('U09-SHIP-SCALAR', JSON.stringify({ refunds: 'pending' }));
    await insertOrder('U09-SHIP-SUBSTRING', JSON.stringify({ refunds: ['pending'] }));
    await insertOrder('U09-SHIP-SETTLED', JSON.stringify({
      refunds: [{ status: 'succeeded' }, { status: 'failed' }],
    }));
    await insertOrder('U09-SHIP-PENDING', JSON.stringify({ refunds: [{ status: 'pending' }] }));
    await insertOrder('U09-SHIP-ACTION', JSON.stringify({
      refunds: [{ status: 'requires_action' }],
    }));

    const result = await env.DB.prepare(`
SELECT id FROM orders
WHERE id LIKE 'U09-SHIP-%'
  AND ${SHIPMENT_NO_UNSETTLED_REFUNDS_SQL}
ORDER BY id
`).all<{ id: string }>();

    expect(result.results.map(({ id }) => id)).toEqual([
      'U09-SHIP-ABSENT',
      'U09-SHIP-MALFORMED',
      'U09-SHIP-SCALAR',
      'U09-SHIP-SETTLED',
      'U09-SHIP-SUBSTRING',
    ]);
  });
});
