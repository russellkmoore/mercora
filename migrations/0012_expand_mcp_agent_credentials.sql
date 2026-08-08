-- Expand MCP credentials without invalidating existing agents.
--
-- Existing `api_key` rows remain readable during the rotation window. The
-- application hashes and retires a legacy plaintext value after its next
-- successful authentication or an explicit management rotation. A later
-- contract migration may remove `api_key` only after operators confirm no
-- credential_version=1 rows remain.
ALTER TABLE mcp_agents ADD COLUMN api_key_hash TEXT;
ALTER TABLE mcp_agents ADD COLUMN api_key_expires_at TEXT;
ALTER TABLE mcp_agents ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_agents_api_key_hash
  ON mcp_agents(api_key_hash)
  WHERE api_key_hash IS NOT NULL;

-- Migration 0004 installed this public demo credential in every environment.
-- Development restores it from data/d1/seed-dev.sql; deployed databases must
-- never retain a credential whose raw value is committed to source control.
DELETE FROM mcp_agents
WHERE agent_id = 'test-agent' AND api_key = 'test-key-123';
