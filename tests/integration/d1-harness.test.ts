import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyTestMigrations } from './helpers/d1';

beforeEach(async () => {
  await applyTestMigrations();
});

describe('real D1 Workers harness', () => {
  it('applies the production migration sequence', async () => {
    const result = await env.DB.prepare(
      'SELECT name FROM d1_migrations ORDER BY id'
    ).all<{ name: string }>();

    expect(result.results.map(({ name }) => name)).toEqual([
      '0001_initial_schema.sql',
      '0002_add_admin_users.sql',
      '0003_add_cms_pages.sql',
      '0004_add_mcp_tables.sql',
      '0005_add_reviews_tables.sql',
      '0006_add_review_reminders.sql',
      '0007_add_analytics_cache.sql',
      '0008_add_processed_webhook_events.sql',
      '0009_add_order_effects.sql',
      '0010_add_inventory_adjustments.sql',
      '0011_add_external_refund_restock_setting.sql',
      '0012_expand_mcp_agent_credentials.sql',
      '0013_add_shipping_carrier.sql',
      '0014_add_order_events.sql',
      '0015_normalize_order_timestamps.sql',
      '0016_enforce_order_timestamp_format.sql',
    ]);
  });

  it('stores canonical ISO UTC timestamps when an order insert omits them', async () => {
    const id = 'U14-DEFAULT-TIMESTAMPS';
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    await env.DB.prepare(`
      INSERT INTO orders (id, total_amount, currency_code, items)
      VALUES (?, ?, 'USD', '[]')
    `).bind(id, JSON.stringify({ amount: 100, currency: 'USD' })).run();

    const stored = await env.DB.prepare(
      'SELECT created_at, updated_at FROM orders WHERE id = ?',
    ).bind(id).first<{ created_at: string; updated_at: string }>();

    expect(stored?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(stored?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('serializes concurrent primary-key claims against real D1', async () => {
    await env.DB.exec('CREATE TABLE harness_claims (event_id TEXT PRIMARY KEY)');

    const attempts = await Promise.allSettled([
      env.DB.prepare('INSERT INTO harness_claims (event_id) VALUES (?)').bind('evt_same').run(),
      env.DB.prepare('INSERT INTO harness_claims (event_id) VALUES (?)').bind('evt_same').run(),
    ]);
    const stored = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM harness_claims WHERE event_id = ?'
    ).bind('evt_same').first<{ count: number }>();

    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(stored?.count).toBe(1);
  });

  it('rolls back every statement when a D1 batch fails', async () => {
    await env.DB.exec('CREATE TABLE harness_batch (event_id TEXT PRIMARY KEY)');

    await expect(env.DB.batch([
      env.DB.prepare('INSERT INTO harness_batch (event_id) VALUES (?)').bind('evt_batch'),
      env.DB.prepare('INSERT INTO harness_batch (event_id) VALUES (?)').bind('evt_batch'),
    ])).rejects.toThrow();

    const stored = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM harness_batch'
    ).first<{ count: number }>();
    expect(stored?.count).toBe(0);
  });
});
