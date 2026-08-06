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
    ]);
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
