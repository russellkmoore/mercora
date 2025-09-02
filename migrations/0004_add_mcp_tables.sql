-- MCP Server Tables
-- Agent sessions for multi-agent commerce

CREATE TABLE IF NOT EXISTS mcp_sessions (
  session_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  user_preferences TEXT,
  session_context TEXT,
  cart TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_activity TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mcp_agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  api_key TEXT UNIQUE NOT NULL,
  permissions TEXT,
  rate_limit_rpm INTEGER DEFAULT 100,
  rate_limit_oph INTEGER DEFAULT 10,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used TEXT
);

CREATE TABLE IF NOT EXISTS mcp_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  tool_name TEXT NOT NULL,
  request_size INTEGER,
  response_size INTEGER,
  processing_time_ms INTEGER,
  success INTEGER NOT NULL,
  error_code TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mcp_rate_limits (
  agent_id TEXT NOT NULL,
  window TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, window)
);

-- Insert test agent for development
INSERT OR REPLACE INTO mcp_agents (
  agent_id,
  name,
  description,
  api_key,
  permissions,
  rate_limit_rpm,
  rate_limit_oph,
  is_active
) VALUES (
  'test-agent',
  'Test Agent',
  'Development test agent for MCP server',
  'test-key-123',
  '["read:products", "write:cart", "place:orders"]',
  1000,
  100,
  1
);