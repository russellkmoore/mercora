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
      '0017_add_product_recommendations.sql',
      '0018_add_email_preferences.sql',
    ]);
  });

  it('adds empty email preference state without changing a populated baseline', async () => {
    const customerId = 'O01-POPULATED-CUSTOMER';
    await env.DB.prepare(`
      INSERT OR IGNORE INTO customers (id, type, person, created_at, updated_at)
      VALUES (?, 'person', ?, ?, ?)
    `).bind(
      customerId,
      JSON.stringify({ email: 'existing@example.com' }),
      '2026-08-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    ).run();

    const customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE id = ?',
    ).bind(customerId).first<{ id: string }>();
    const preferences = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM email_preferences',
    ).first<{ count: number }>();

    expect(customer?.id).toBe(customerId);
    expect(preferences?.count).toBe(0);
    const deliveries = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM email_deliveries',
    ).first<{ count: number }>();
    expect(deliveries?.count).toBe(0);
  });

  it('installs recommendation defaults and enforces recommendation row invariants', async () => {
    const settings = await env.DB.prepare(
      `SELECT key, value FROM admin_settings
       WHERE category = 'recommendations' ORDER BY key`,
    ).all<{ key: string; value: string }>();
    expect(settings.results).toEqual([
      { key: 'recommendations.exclude_owned', value: 'true' },
      { key: 'recommendations.limit', value: '3' },
      { key: 'recommendations.personalize', value: 'true' },
      { key: 'recommendations.strategy', value: '"deterministic"' },
    ]);

    await expect(
      env.DB.prepare(
        `INSERT INTO product_recommendations
          (source_product_id, recommended_product_id, rank)
         VALUES ('same', 'same', 0)`,
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO product_recommendations
          (source_product_id, recommended_product_id, rank)
         VALUES ('source', 'recommended', -1)`,
      ).run(),
    ).rejects.toThrow();
  });

  it('generates canonical UTC timestamps for recommendation rows', async () => {
    await env.DB.prepare(
      `INSERT INTO product_recommendations
        (source_product_id, recommended_product_id, rank)
       VALUES ('source', 'recommended', 0)`,
    ).run();
    const row = await env.DB.prepare(
      `SELECT generated_at FROM product_recommendations
       WHERE source_product_id = 'source'`,
    ).first<{ generated_at: string }>();
    expect(row?.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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
