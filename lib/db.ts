/**
 * === Database Connection Module ===
 *
 * Centralized database configuration and connection management for the
 * Cloudflare D1 database using Drizzle ORM. Provides both synchronous
 * and asynchronous database access patterns with React caching.
 *
 * === Features ===
 * - **Cloudflare D1 Integration**: Native Cloudflare Workers database
 * - **Drizzle ORM**: Type-safe database operations with SQL-like syntax
 * - **React Caching**: Automatic request-level caching for performance
 * - **Schema Management**: Centralized schema imports and type safety
 * - **Dual Access Patterns**: Both sync and async database connections
 * - **Environment Isolation**: Automatic environment context resolution
 *
 * === Technical Implementation ===
 * - **OpenNext Integration**: Uses Cloudflare context for Workers compatibility
 * - **Connection Pooling**: Leverages D1's built-in connection management
 * - **Type Safety**: Full TypeScript integration with Drizzle schema
 * - **Caching Strategy**: React cache() for request-level memoization
 *
 * === Database Architecture ===
 * - **D1 Database**: Cloudflare's edge-native SQLite database
 * - **Global Distribution**: Data replicated across Cloudflare's edge
 * - **ACID Transactions**: Full transactional support for data integrity
 * - **Automatic Scaling**: No connection limits or manual scaling required
 *
 * === Usage Patterns ===
 * ```typescript
 * // Server Components (synchronous)
 * const db = getDb();
 * const products = await db.select().from(schema.products);
 * 
 * // API Routes (asynchronous context)
 * const db = await getDbAsync();
 * const result = await db.insert(schema.orders).values(orderData);
 * ```
 *
 * === Performance Benefits ===
 * - Sub-millisecond query execution on edge
 * - Automatic caching reduces redundant database calls
 * - No cold starts with edge-native architecture
 * - Efficient query planning with Drizzle's SQL generation
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import * as schema from "./db/schema/";

/**
 * Get database instance for Server Components and synchronous contexts
 * 
 * Uses React cache() to memoize the database connection at the request level,
 * preventing multiple database instance creations during a single request.
 * 
 * @returns Drizzle database instance with full schema typing
 */
export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
});

/**
 * Get database instance for API routes and asynchronous contexts
 * 
 * Async version for use in API routes where Cloudflare context
 * needs to be resolved asynchronously. Also cached at request level.
 * 
 * @returns Promise resolving to Drizzle database instance
 */
export const getDbAsync = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
});
