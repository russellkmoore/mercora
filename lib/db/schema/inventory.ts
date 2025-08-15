/**
 * MACH Alliance Open Data Model - Inventory Schema
 * 
 * Drizzle ORM schema for the Inventory entity following the MACH Alliance standards.
 * Optimized for Cloudflare D1 database with JSON storage for complex objects.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/inventory/inventory.md
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { Inventory, InventoryQuantities } from "@/lib/types";

/**
 * Inventory table schema
 * 
 * Holds real-time, location-level stock picture for a single SKU
 * enabling consistent availability, reservation, and fulfillment decisions.
 */
export const inventory = sqliteTable("inventory", {
  // Core identification - REQUIRED
  id: text("id").primaryKey(),
  skuId: text("sku_id").notNull(),
  locationId: text("location_id").notNull(),
  
  // Stock quantities stored as JSON - REQUIRED
  quantities: text("quantities", { mode: "json" }).$type<InventoryQuantities>().notNull(),
  
  // Status and state - OPTIONAL
  status: text("status", { enum: ["draft", "active", "inactive"] }).default("active"),
  stockStatus: text("stock_status", { 
    enum: ["in_stock", "out_of_stock", "backorder", "preorder"] 
  }),
  
  // External references stored as JSON - OPTIONAL
  externalReferences: text("external_references", { mode: "json" }).$type<Record<string, string>>(),
  
  // Timestamps - OPTIONAL
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
  
  // Policy and rules - OPTIONAL
  policyId: text("policy_id"),
  backorderable: integer("backorderable", { mode: "boolean" }).default(false),
  backorderEta: text("backorder_eta"),
  safetyStock: integer("safety_stock").default(0),
  
  // Concurrency control - OPTIONAL
  version: integer("version").default(0),
  
  // Extensions for custom data - OPTIONAL
  extensions: text("extensions", { mode: "json" }).$type<Record<string, any>>(),
});

/**
 * Validate quantities to ensure business rules
 */
export function validateInventoryQuantities(quantities: InventoryQuantities): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic validation
  if (quantities.on_hand < 0) {
    errors.push("on_hand cannot be negative");
  }
  
  if (quantities.reserved < 0) {
    errors.push("reserved cannot be negative");
  }
  
  if (quantities.incoming !== undefined && quantities.incoming < 0) {
    errors.push("incoming cannot be negative");
  }
  
  if (quantities.allocated !== undefined && quantities.allocated < 0) {
    errors.push("allocated cannot be negative");
  }
  
  if (quantities.damaged !== undefined && quantities.damaged < 0) {
    errors.push("damaged cannot be negative");
  }
  
  // Business logic validation
  if (quantities.reserved > quantities.on_hand) {
    warnings.push("reserved quantity exceeds on_hand quantity");
  }
  
  // Available should be calculated consistently
  const calculatedAvailable = quantities.on_hand - quantities.reserved;
  if (Math.abs(quantities.available - calculatedAvailable) > 0.01) {
    warnings.push(`available (${quantities.available}) doesn't match calculated value (${calculatedAvailable})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate stock status based on quantities
 */
export function calculateStockStatus(
  quantities: InventoryQuantities, 
  backorderable?: boolean,
  safetyStock?: number
): "in_stock" | "out_of_stock" | "backorder" | "preorder" {
  const effectiveAvailable = quantities.available - (safetyStock || 0);
  
  if (effectiveAvailable > 0) {
    return "in_stock";
  }
  
  if (effectiveAvailable === 0) {
    // Check if we have incoming stock
    if (quantities.incoming && quantities.incoming > 0) {
      return "preorder";
    }
    return "out_of_stock";
  }
  
  // Available is negative
  if (backorderable && quantities.incoming && quantities.incoming > 0) {
    return "backorder";
  }
  
  return "out_of_stock";
}

/**
 * Calculate available quantity with safety stock
 */
export function calculateAvailableQuantity(
  onHand: number,
  reserved: number,
  safetyStock: number = 0
): number {
  return Math.max(0, onHand - reserved - safetyStock);
}

/**
 * Check if inventory can fulfill a specific quantity
 */
export function canFulfillQuantity(
  inventory: Inventory,
  requestedQuantity: number
): {
  canFulfill: boolean;
  availableQuantity: number;
  shortfall?: number;
  canBackorder?: boolean;
} {
  const effectiveAvailable = calculateAvailableQuantity(
    inventory.quantities.on_hand,
    inventory.quantities.reserved,
    inventory.safety_stock
  );
  
  const canFulfill = effectiveAvailable >= requestedQuantity;
  const shortfall = canFulfill ? undefined : requestedQuantity - effectiveAvailable;
  const canBackorder = inventory.backorderable && !!inventory.quantities.incoming;
  
  return {
    canFulfill,
    availableQuantity: effectiveAvailable,
    shortfall,
    canBackorder
  };
}

// Helper: convert DB record to MACH Inventory
export function deserializeInventory(record: typeof inventory.$inferSelect): Inventory {
  return {
    id: record.id,
    sku_id: record.skuId,
    location_id: record.locationId,
    quantities: record.quantities,
    status: record.status || "active",
    stock_status: record.stockStatus || undefined,
    external_references: record.externalReferences || undefined,
    created_at: record.createdAt || undefined,
    updated_at: record.updatedAt || undefined,
    policy_id: record.policyId || undefined,
    backorderable: record.backorderable || false,
    backorder_eta: record.backorderEta || undefined,
    safety_stock: record.safetyStock || 0,
    version: record.version || 0,
    extensions: record.extensions || undefined,
  };
}

// Helper: convert MACH Inventory to DB insert format
export function serializeInventory(machInventory: Inventory): typeof inventory.$inferInsert {
  return {
    id: machInventory.id,
    skuId: machInventory.sku_id,
    locationId: machInventory.location_id,
    quantities: machInventory.quantities,
    status: machInventory.status || "active",
    stockStatus: machInventory.stock_status,
    externalReferences: machInventory.external_references,
    createdAt: machInventory.created_at,
    updatedAt: machInventory.updated_at,
    policyId: machInventory.policy_id,
    backorderable: machInventory.backorderable || false,
    backorderEta: machInventory.backorder_eta,
    safetyStock: machInventory.safety_stock || 0,
    version: machInventory.version || 0,
    extensions: machInventory.extensions,
  };
}

// Type exports for easier use
export type InventoryRecord = typeof inventory.$inferSelect;
export type InventoryInsert = typeof inventory.$inferInsert;
