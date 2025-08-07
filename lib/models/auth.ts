// lib/models/auth.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations, eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";

// API tokens table for unified authentication
export const apiTokens = sqliteTable("api_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenName: text("token_name").notNull().unique(), // 'admin_vectorize', 'admin_orders', 'webhook_carrier'
  tokenHash: text("token_hash").notNull(), // SHA-256 hash of actual token
  permissions: text("permissions", { mode: "json" }).notNull(), // JSON array of permissions
  active: integer("active", { mode: "boolean" }).default(true),
  expiresAt: text("expires_at"), // Optional expiration
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const apiTokenRelations = relations(apiTokens, () => ({}));

// Database operations for API tokens
export async function insertApiToken(tokenData: {
  tokenName: string;
  tokenHash: string;
  permissions: string[];
  expiresAt?: string;
}) {
  const db = await getDbAsync();
  const inserted = await db.insert(apiTokens).values({
    ...tokenData,
    permissions: JSON.stringify(tokenData.permissions),
  }).returning();
  return inserted[0];
}

export async function getApiTokenByHash(tokenHash: string) {
  const db = await getDbAsync();
  const tokens = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, tokenHash),
        eq(apiTokens.active, true)
      )
    )
    .limit(1);
  return tokens[0] || null;
}

export async function getApiTokenByName(tokenName: string) {
  const db = await getDbAsync();
  const tokens = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenName, tokenName))
    .limit(1);
  return tokens[0] || null;
}

export async function getAllApiTokens() {
  const db = await getDbAsync();
  return db.select().from(apiTokens);
}

export async function updateApiTokenLastUsed(id: number) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  return db
    .update(apiTokens)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(apiTokens.id, id));
}

export async function revokeApiToken(tokenName: string) {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  const result = await db
    .update(apiTokens)
    .set({ active: false, updatedAt: now })
    .where(eq(apiTokens.tokenName, tokenName));
  
  return result.meta?.changes ? result.meta.changes > 0 : false;
}

export async function deleteExpiredTokens() {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  return db
    .update(apiTokens)
    .set({ active: false })
    .where(
      and(
        eq(apiTokens.active, true),
        sql`${apiTokens.expiresAt} < ${now}`
      )
    );
}
