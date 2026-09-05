-- Development-only MCP credential. Production and preview migration commands
-- never execute this file.
--
-- Raw key for local testing: test-key-123
-- SHA-256: 625faa3fbbc3d2bd9d6ee7678d04cc5339cb33dc68d9b58451853d60046e226a
INSERT INTO mcp_agents (
  agent_id,
  name,
  description,
  api_key,
  api_key_hash,
  api_key_expires_at,
  credential_version,
  permissions,
  rate_limit_rpm,
  rate_limit_oph,
  is_active
) VALUES (
  'test-agent',
  'Test Agent',
  'Development-only MCP test agent',
  'retired:test-agent:dev-seed',
  '625faa3fbbc3d2bd9d6ee7678d04cc5339cb33dc68d9b58451853d60046e226a',
  datetime('now', '+365 days'),
  2,
  '["read:products", "write:cart", "place:orders"]',
  1000,
  100,
  1
)
ON CONFLICT(agent_id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  api_key = excluded.api_key,
  api_key_hash = excluded.api_key_hash,
  api_key_expires_at = excluded.api_key_expires_at,
  credential_version = excluded.credential_version,
  permissions = excluded.permissions,
  rate_limit_rpm = excluded.rate_limit_rpm,
  rate_limit_oph = excluded.rate_limit_oph,
  is_active = excluded.is_active;

-- Development-only guest order fixture so the token-gated /order-status/<id> page has
-- something to render locally and can be screenshotted (docs/theming.md documents this
-- id). customer_id is NULL, which is what makes this a guest order — the only kind the
-- page serves. The id is fixed ('dev-order-001') so the capture command can hardcode it.
-- DO NOTHING (not DO UPDATE) keeps `predev`'s every-startup re-run idempotent without
-- ever touching the row after first insert.
INSERT INTO orders (
  id, customer_id, status, total_amount, currency_code,
  shipping_address, items, payment_status, shipped_at, tracking_number, created_at
) VALUES (
  'dev-order-001',
  NULL,
  'shipped',
  '{"amount":4999,"currency":"USD"}',
  'USD',
  '{"street":"1 Main St","city":"Denver","state":"CO","zipCode":"80202","country":"US"}',
  '[{"product_id":"dev-fixture-item","sku":"DEV-SKU-001","quantity":1,"unit_price":{"amount":4999,"currency":"USD"},"total_price":{"amount":4999,"currency":"USD"},"product_name":"Dev Fixture Item"}]',
  'paid',
  datetime('now'),
  'DEV-TRACK-001',
  datetime('now')
)
ON CONFLICT(id) DO NOTHING;
