import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

/**
 * Admin Users Table
 * 
 * Stores user IDs who have admin access to the system.
 * This replaces the environment variable approach for more flexible management.
 */
export const adminUsers = sqliteTable('admin_users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().unique(),
  email: text('email'),
  displayName: text('display_name'),
  role: text('role', { enum: ['admin', 'super_admin'] }).notNull().default('admin'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  createdBy: text('created_by'), // User ID of who granted admin access
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLogin: text('last_login'),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;