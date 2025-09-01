-- Migration: Add admin_users table for database-based admin access management
-- Date: 2025-08-31
-- Description: Replace environment variable ADMIN_USER_IDS with database table

CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT, -- User ID of who granted admin access
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    last_login TEXT
);

-- Insert current admin users from environment variable
-- Note: These will need to be added manually after migration
-- INSERT INTO admin_users (user_id, role, created_at) VALUES
-- ('user_30ISTjcD9nHbIi9ydYXwMVsFPoq', 'super_admin', datetime('now')),
-- ('user_30Ib51kH6cLzXPSF9LyXz6j5m0I', 'admin', datetime('now'));

-- Create index for fast user lookups
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);
CREATE INDEX idx_admin_users_role ON admin_users(role);