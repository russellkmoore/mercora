/**
 * MACH Alliance Open Data Model - Inventory Model
 * 
 * Business logic and CRUD operations for inventory management
 * following the MACH Alliance Inventory specification.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/inventory/inventory.md
 */

import { getDbAsync } from "@/lib/db";
import {
  inventory,
  deserializeInventory,
  serializeInventory,
  validateInventoryQuantities,
  calculateStockStatus,
  canFulfillQuantity,
  calculateAvailableQuantity
} from "@/lib/db/schema/inventory";
import { eq, desc, asc, and, or, inArray, isNull, isNotNull, sql, gte, lte } from "drizzle-orm";
import type { 
  MACHInventory, 
  MACHInventoryQuantities,
  MACHInventoryLocation,
  MACHInventoryPolicy
} from "../../types/mach/Inventory";

// Re-export types for easier access
export type { 
  MACHInventory,
  MACHInventoryQuantities,
  MACHInventoryLocation,
  MACHInventoryPolicy
} from "../../types/mach/Inventory";

// Inventory creation input type
export interface CreateInventoryInput {
  // Required fields
  id?: string; // Will be auto-generated if not provided
  sku_id: string;
  location_id: string;
  quantities: MACHInventoryQuantities;
  
  // Optional fields
  status?: "draft" | "active" | "inactive";
  stock_status?: "in_stock" | "out_of_stock" | "backorder" | "preorder";
  external_references?: Record<string, string>;
  policy_id?: string;
  backorderable?: boolean;
  backorder_eta?: string;
  safety_stock?: number;
  version?: number;
  extensions?: Record<string, any>;
}

// Inventory update input type
export interface UpdateInventoryInput extends Partial<CreateInventoryInput> {
  id: string;
  version?: number; // For optimistic concurrency control
}

// Inventory filter options
export interface InventoryFilters {
  sku_id?: string | string[];
  location_id?: string | string[];
  status?: "draft" | "active" | "inactive" | ("draft" | "active" | "inactive")[];
  stock_status?: "in_stock" | "out_of_stock" | "backorder" | "preorder" | ("in_stock" | "out_of_stock" | "backorder" | "preorder")[];
  policy_id?: string | string[];
  backorderable?: boolean;
  has_safety_stock?: boolean;
  has_incoming?: boolean;
  has_damaged?: boolean;
  min_on_hand?: number;
  max_on_hand?: number;
  min_available?: number;
  max_available?: number;
  min_reserved?: number;
  max_reserved?: number;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  low_stock_threshold?: number; // Available quantity below this threshold
  overstocked_threshold?: number; // Available quantity above this threshold
  version_greater_than?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'sku_id' | 'location_id' | 'version' | 'on_hand' | 'available';
  sortOrder?: 'asc' | 'desc';
}

// Inventory validation result
export interface InventoryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Inventory reservation input
export interface ReserveInventoryInput {
  inventory_id: string;
  quantity: number;
  reservation_id?: string; // Optional reservation identifier
  reason?: string; // Reason for reservation (order, cart, etc.)
  expires_at?: string; // When reservation expires
}

// Inventory adjustment input
export interface InventoryAdjustmentInput {
  inventory_id: string;
  type: "recount" | "damage" | "loss" | "found" | "return" | "transfer_in" | "transfer_out";
  quantity_change: number; // Positive or negative
  reason: string;
  reference?: string; // Order ID, transfer ID, etc.
  cost_impact?: number; // Financial impact of adjustment
}

/**
 * Generate a unique inventory ID
 */
function generateInventoryId(skuId: string, locationId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `INV-${skuId}-${locationId}-${timestamp}-${random}`;
}

/**
 * Validate inventory data according to MACH Alliance standards
 */
export function validateInventory(inventory: Partial<MACHInventory>): InventoryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!inventory.id) {
    errors.push("id is required");
  }
  
  if (!inventory.sku_id) {
    errors.push("sku_id is required");
  }
  
  if (!inventory.location_id) {
    errors.push("location_id is required");
  }
  
  if (!inventory.quantities) {
    errors.push("quantities is required");
  } else {
    // Validate quantities using utility function
    const quantityValidation = validateInventoryQuantities(inventory.quantities);
    errors.push(...quantityValidation.errors);
    warnings.push(...quantityValidation.warnings);
  }
  
  // Status validation
  if (inventory.status && !["draft", "active", "inactive"].includes(inventory.status)) {
    errors.push("status must be one of: draft, active, inactive");
  }
  
  if (inventory.stock_status && !["in_stock", "out_of_stock", "backorder", "preorder"].includes(inventory.stock_status)) {
    errors.push("stock_status must be one of: in_stock, out_of_stock, backorder, preorder");
  }
  
  // Safety stock validation
  if (inventory.safety_stock !== undefined && inventory.safety_stock < 0) {
    errors.push("safety_stock cannot be negative");
  }
  
  // Version validation
  if (inventory.version !== undefined && inventory.version < 0) {
    errors.push("version cannot be negative");
  }
  
  // Business logic warnings
  if (inventory.quantities && inventory.safety_stock) {
    if (inventory.safety_stock > inventory.quantities.on_hand) {
      warnings.push("safety_stock exceeds on_hand quantity");
    }
  }
  
  // Backorder validation
  if (inventory.backorderable && inventory.stock_status === "backorder" && !inventory.backorder_eta) {
    warnings.push("backorder_eta should be provided when stock_status is backorder");
  }
  
  // Timestamp validation
  if (inventory.created_at) {
    try {
      new Date(inventory.created_at);
    } catch {
      errors.push("created_at must be a valid ISO 8601 timestamp");
    }
  }
  
  if (inventory.updated_at) {
    try {
      new Date(inventory.updated_at);
    } catch {
      errors.push("updated_at must be a valid ISO 8601 timestamp");
    }
  }
  
  if (inventory.backorder_eta) {
    try {
      new Date(inventory.backorder_eta);
    } catch {
      errors.push("backorder_eta must be a valid ISO 8601 timestamp");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a new inventory record
 */
export async function createInventory(input: CreateInventoryInput): Promise<MACHInventory> {
  const id = input.id || generateInventoryId(input.sku_id, input.location_id);
  const now = new Date().toISOString();
  
  // Auto-calculate stock status if not provided
  const stockStatus = input.stock_status || calculateStockStatus(
    input.quantities,
    input.backorderable,
    input.safety_stock
  );
  
  const machInventory: MACHInventory = {
    id,
    sku_id: input.sku_id,
    location_id: input.location_id,
    quantities: input.quantities,
    status: input.status ?? "active",
    stock_status: stockStatus,
    external_references: input.external_references,
    created_at: now,
    updated_at: now,
    policy_id: input.policy_id,
    backorderable: input.backorderable ?? false,
    backorder_eta: input.backorder_eta,
    safety_stock: input.safety_stock ?? 0,
    version: input.version ?? 0,
    extensions: input.extensions,
  };
  
  // Validate before creating
  const validation = validateInventory(machInventory);
  if (!validation.isValid) {
    throw new Error(`Inventory validation failed: ${validation.errors.join(', ')}`);
  }
  
  const db = await getDbAsync();
  const record = serializeInventory(machInventory);
  const [created] = await db.insert(inventory).values(record).returning();
  return deserializeInventory(created);
}

/**
 * Get inventory by ID
 */
export async function getInventory(id: string): Promise<MACHInventory | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.id, id))
    .limit(1);
    
  if (!record) return null;
  return deserializeInventory(record);
}

/**
 * Get inventory by SKU and location
 */
export async function getInventoryBySkuAndLocation(skuId: string, locationId: string): Promise<MACHInventory | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(inventory)
    .where(and(
      eq(inventory.skuId, skuId),
      eq(inventory.locationId, locationId)
    ))
    .limit(1);
    
  if (!record) return null;
  return deserializeInventory(record);
}

/**
 * List inventory records with filtering and pagination
 */
export async function listInventory(filters: InventoryFilters = {}): Promise<MACHInventory[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(inventory);
  
  // Build where conditions
  const conditions: any[] = [];
  
  // SKU filter
  if (filters.sku_id) {
    if (Array.isArray(filters.sku_id)) {
      conditions.push(inArray(inventory.skuId, filters.sku_id));
    } else {
      conditions.push(eq(inventory.skuId, filters.sku_id));
    }
  }
  
  // Location filter
  if (filters.location_id) {
    if (Array.isArray(filters.location_id)) {
      conditions.push(inArray(inventory.locationId, filters.location_id));
    } else {
      conditions.push(eq(inventory.locationId, filters.location_id));
    }
  }
  
  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(inventory.status, filters.status));
    } else {
      conditions.push(eq(inventory.status, filters.status));
    }
  }
  
  // Stock status filter
  if (filters.stock_status) {
    if (Array.isArray(filters.stock_status)) {
      conditions.push(inArray(inventory.stockStatus, filters.stock_status));
    } else {
      conditions.push(eq(inventory.stockStatus, filters.stock_status));
    }
  }
  
  // Policy filter
  if (filters.policy_id) {
    if (Array.isArray(filters.policy_id)) {
      conditions.push(inArray(inventory.policyId, filters.policy_id));
    } else {
      conditions.push(eq(inventory.policyId, filters.policy_id));
    }
  }
  
  // Backorderable filter
  if (filters.backorderable !== undefined) {
    conditions.push(eq(inventory.backorderable, filters.backorderable));
  }
  
  // Safety stock filter
  if (filters.has_safety_stock !== undefined) {
    if (filters.has_safety_stock) {
      conditions.push(sql`${inventory.safetyStock} > 0`);
    } else {
      conditions.push(sql`${inventory.safetyStock} = 0`);
    }
  }
  
  // Date range filters
  if (filters.created_after) {
    conditions.push(sql`${inventory.createdAt} >= ${filters.created_after}`);
  }
  if (filters.created_before) {
    conditions.push(sql`${inventory.createdAt} <= ${filters.created_before}`);
  }
  if (filters.updated_after) {
    conditions.push(sql`${inventory.updatedAt} >= ${filters.updated_after}`);
  }
  if (filters.updated_before) {
    conditions.push(sql`${inventory.updatedAt} <= ${filters.updated_before}`);
  }
  
  // Version filter
  if (filters.version_greater_than !== undefined) {
    conditions.push(sql`${inventory.version} > ${filters.version_greater_than}`);
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  // Add sorting
  const sortField = filters.sortBy || 'updated_at';
  const sortDir = filters.sortOrder || 'desc';
  
  switch (sortField) {
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(inventory.createdAt) : desc(inventory.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(inventory.updatedAt) : desc(inventory.updatedAt)) as typeof query;
      break;
    case 'sku_id':
      query = query.orderBy(sortDir === 'asc' ? asc(inventory.skuId) : desc(inventory.skuId)) as typeof query;
      break;
    case 'location_id':
      query = query.orderBy(sortDir === 'asc' ? asc(inventory.locationId) : desc(inventory.locationId)) as typeof query;
      break;
    case 'version':
      query = query.orderBy(sortDir === 'asc' ? asc(inventory.version) : desc(inventory.version)) as typeof query;
      break;
    default:
      query = query.orderBy(desc(inventory.updatedAt)) as typeof query;
  }
  
  // Add pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }
  
  const records = await query;
  let inventoryList = records.map(deserializeInventory);
  
  // Apply additional filters that require JSON parsing
  if (filters.min_on_hand !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.on_hand >= filters.min_on_hand!);
  }
  
  if (filters.max_on_hand !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.on_hand <= filters.max_on_hand!);
  }
  
  if (filters.min_available !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.available >= filters.min_available!);
  }
  
  if (filters.max_available !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.available <= filters.max_available!);
  }
  
  if (filters.min_reserved !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.reserved >= filters.min_reserved!);
  }
  
  if (filters.max_reserved !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.reserved <= filters.max_reserved!);
  }
  
  if (filters.has_incoming !== undefined) {
    inventoryList = inventoryList.filter(inv => 
      filters.has_incoming ? (inv.quantities.incoming || 0) > 0 : (inv.quantities.incoming || 0) === 0
    );
  }
  
  if (filters.has_damaged !== undefined) {
    inventoryList = inventoryList.filter(inv => 
      filters.has_damaged ? (inv.quantities.damaged || 0) > 0 : (inv.quantities.damaged || 0) === 0
    );
  }
  
  if (filters.low_stock_threshold !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.available < filters.low_stock_threshold!);
  }
  
  if (filters.overstocked_threshold !== undefined) {
    inventoryList = inventoryList.filter(inv => inv.quantities.available > filters.overstocked_threshold!);
  }
  
  return inventoryList;
}

/**
 * Get inventory count with filters
 */
export async function getInventoryCount(filters: Omit<InventoryFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
  const inventoryList = await listInventory(filters);
  return inventoryList.length;
}

/**
 * Update inventory record with optimistic concurrency control
 */
export async function updateInventory(id: string, input: Partial<CreateInventoryInput>, expectedVersion?: number): Promise<MACHInventory | null> {
  const db = await getDbAsync();
  
  // Get existing inventory first
  const existing = await getInventory(id);
  if (!existing) return null;
  
  // Check version for optimistic concurrency control
  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new Error(`Version mismatch. Expected ${expectedVersion}, got ${existing.version}. Record may have been updated by another process.`);
  }
  
  const now = new Date().toISOString();
  
  // Auto-calculate stock status if quantities changed
  let stockStatus = input.stock_status;
  if (input.quantities && !input.stock_status) {
    stockStatus = calculateStockStatus(
      input.quantities,
      input.backorderable ?? existing.backorderable,
      input.safety_stock ?? existing.safety_stock
    );
  }
  
  // Create updated inventory object
  const updated: MACHInventory = {
    ...existing,
    ...input,
    id, // Ensure ID stays the same
    updated_at: now,
    stock_status: stockStatus || existing.stock_status,
    version: (existing.version || 0) + 1, // Increment version
  };
  
  // Validate before updating
  const validation = validateInventory(updated);
  if (!validation.isValid) {
    throw new Error(`Inventory validation failed: ${validation.errors.join(', ')}`);
  }
  
  const record = serializeInventory(updated);
  await db.update(inventory).set(record).where(eq(inventory.id, id));
  
  return getInventory(id);
}

/**
 * Delete inventory record (soft delete by setting status to inactive)
 */
export async function deleteInventory(id: string): Promise<boolean> {
  const result = await updateInventory(id, { status: "inactive" });
  return !!result;
}

/**
 * Hard delete inventory record (permanent removal)
 */
export async function hardDeleteInventory(id: string): Promise<boolean> {
  const db = await getDbAsync();
  
  await db.delete(inventory).where(eq(inventory.id, id));
  return true;
}

/**
 * Get inventory for a specific SKU across all locations
 */
export async function getInventoryBySku(skuId: string): Promise<MACHInventory[]> {
  return listInventory({ sku_id: skuId });
}

/**
 * Get inventory for a specific location across all SKUs
 */
export async function getInventoryByLocation(locationId: string): Promise<MACHInventory[]> {
  return listInventory({ location_id: locationId });
}

/**
 * Get inventory records with low stock
 */
export async function getLowStockInventory(threshold: number = 10): Promise<MACHInventory[]> {
  return listInventory({ low_stock_threshold: threshold, status: "active" });
}

/**
 * Get inventory records that are out of stock
 */
export async function getOutOfStockInventory(): Promise<MACHInventory[]> {
  return listInventory({ stock_status: "out_of_stock", status: "active" });
}

/**
 * Get inventory records available for backorder
 */
export async function getBackorderableInventory(): Promise<MACHInventory[]> {
  return listInventory({ backorderable: true, status: "active" });
}

/**
 * Get overstocked inventory
 */
export async function getOverstockedInventory(threshold: number = 1000): Promise<MACHInventory[]> {
  return listInventory({ overstocked_threshold: threshold, status: "active" });
}

/**
 * Reserve inventory for an order or cart
 */
export async function reserveInventory(input: ReserveInventoryInput): Promise<{
  success: boolean;
  inventory?: MACHInventory;
  error?: string;
}> {
  const inventory = await getInventory(input.inventory_id);
  if (!inventory) {
    return { success: false, error: "Inventory record not found" };
  }
  
  // Check if we can fulfill the requested quantity
  const fulfillmentCheck = canFulfillQuantity(inventory, input.quantity);
  if (!fulfillmentCheck.canFulfill && !inventory.backorderable) {
    return { 
      success: false, 
      error: `Cannot reserve ${input.quantity} units. Only ${fulfillmentCheck.availableQuantity} available and backorders not allowed.` 
    };
  }
  
  // Calculate new quantities
  const newReserved = inventory.quantities.reserved + input.quantity;
  const newAvailable = calculateAvailableQuantity(
    inventory.quantities.on_hand,
    newReserved,
    inventory.safety_stock
  );
  
  const updatedQuantities: MACHInventoryQuantities = {
    ...inventory.quantities,
    reserved: newReserved,
    available: newAvailable
  };
  
  try {
    const updatedInventory = await updateInventory(input.inventory_id, {
      quantities: updatedQuantities
    }, inventory.version);
    
    return { success: true, inventory: updatedInventory! };
  } catch (error) {
    return { success: false, error: `Failed to reserve inventory: ${error}` };
  }
}

/**
 * Release reserved inventory
 */
export async function releaseReservation(inventoryId: string, quantity: number): Promise<{
  success: boolean;
  inventory?: MACHInventory;
  error?: string;
}> {
  const inventory = await getInventory(inventoryId);
  if (!inventory) {
    return { success: false, error: "Inventory record not found" };
  }
  
  if (inventory.quantities.reserved < quantity) {
    return { 
      success: false, 
      error: `Cannot release ${quantity} units. Only ${inventory.quantities.reserved} reserved.` 
    };
  }
  
  // Calculate new quantities
  const newReserved = inventory.quantities.reserved - quantity;
  const newAvailable = calculateAvailableQuantity(
    inventory.quantities.on_hand,
    newReserved,
    inventory.safety_stock
  );
  
  const updatedQuantities: MACHInventoryQuantities = {
    ...inventory.quantities,
    reserved: newReserved,
    available: newAvailable
  };
  
  try {
    const updatedInventory = await updateInventory(inventoryId, {
      quantities: updatedQuantities
    }, inventory.version);
    
    return { success: true, inventory: updatedInventory! };
  } catch (error) {
    return { success: false, error: `Failed to release reservation: ${error}` };
  }
}

/**
 * Fulfill reserved inventory (move from reserved to fulfilled)
 */
export async function fulfillInventory(inventoryId: string, quantity: number): Promise<{
  success: boolean;
  inventory?: MACHInventory;
  error?: string;
}> {
  const inventory = await getInventory(inventoryId);
  if (!inventory) {
    return { success: false, error: "Inventory record not found" };
  }
  
  if (inventory.quantities.reserved < quantity) {
    return { 
      success: false, 
      error: `Cannot fulfill ${quantity} units. Only ${inventory.quantities.reserved} reserved.` 
    };
  }
  
  if (inventory.quantities.on_hand < quantity) {
    return { 
      success: false, 
      error: `Cannot fulfill ${quantity} units. Only ${inventory.quantities.on_hand} on hand.` 
    };
  }
  
  // Calculate new quantities
  const newOnHand = inventory.quantities.on_hand - quantity;
  const newReserved = inventory.quantities.reserved - quantity;
  const newAvailable = calculateAvailableQuantity(
    newOnHand,
    newReserved,
    inventory.safety_stock
  );
  
  const updatedQuantities: MACHInventoryQuantities = {
    ...inventory.quantities,
    on_hand: newOnHand,
    reserved: newReserved,
    available: newAvailable
  };
  
  try {
    const updatedInventory = await updateInventory(inventoryId, {
      quantities: updatedQuantities
    }, inventory.version);
    
    return { success: true, inventory: updatedInventory! };
  } catch (error) {
    return { success: false, error: `Failed to fulfill inventory: ${error}` };
  }
}

/**
 * Adjust inventory quantities (for receiving, damage, loss, etc.)
 */
export async function adjustInventory(input: InventoryAdjustmentInput): Promise<{
  success: boolean;
  inventory?: MACHInventory;
  adjustment?: any; // Would be proper adjustment record type in real implementation
  error?: string;
}> {
  const inventory = await getInventory(input.inventory_id);
  if (!inventory) {
    return { success: false, error: "Inventory record not found" };
  }
  
  // Calculate new quantities based on adjustment type
  let newQuantities = { ...inventory.quantities };
  
  switch (input.type) {
    case "recount":
      // Recount adjusts on_hand directly
      newQuantities.on_hand = Math.max(0, inventory.quantities.on_hand + input.quantity_change);
      break;
      
    case "damage":
      // Damage reduces on_hand and increases damaged
      newQuantities.on_hand = Math.max(0, inventory.quantities.on_hand - Math.abs(input.quantity_change));
      newQuantities.damaged = (newQuantities.damaged || 0) + Math.abs(input.quantity_change);
      break;
      
    case "loss":
      // Loss simply reduces on_hand
      newQuantities.on_hand = Math.max(0, inventory.quantities.on_hand - Math.abs(input.quantity_change));
      break;
      
    case "found":
      // Found increases on_hand
      newQuantities.on_hand = inventory.quantities.on_hand + Math.abs(input.quantity_change);
      break;
      
    case "return":
      // Return increases on_hand
      newQuantities.on_hand = inventory.quantities.on_hand + Math.abs(input.quantity_change);
      break;
      
    case "transfer_in":
      // Transfer in increases on_hand
      newQuantities.on_hand = inventory.quantities.on_hand + Math.abs(input.quantity_change);
      break;
      
    case "transfer_out":
      // Transfer out reduces on_hand
      newQuantities.on_hand = Math.max(0, inventory.quantities.on_hand - Math.abs(input.quantity_change));
      break;
      
    default:
      return { success: false, error: `Unknown adjustment type: ${input.type}` };
  }
  
  // Recalculate available quantity
  newQuantities.available = calculateAvailableQuantity(
    newQuantities.on_hand,
    newQuantities.reserved,
    inventory.safety_stock
  );
  
  try {
    const updatedInventory = await updateInventory(input.inventory_id, {
      quantities: newQuantities
    }, inventory.version);
    
    // In a real implementation, you would also create an adjustment record
    const adjustmentRecord = {
      id: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      inventory_id: input.inventory_id,
      type: input.type,
      quantity_change: input.quantity_change,
      reason: input.reason,
      reference: input.reference,
      cost_impact: input.cost_impact,
      created_at: new Date().toISOString(),
      quantities_before: inventory.quantities,
      quantities_after: newQuantities
    };
    
    return { 
      success: true, 
      inventory: updatedInventory!,
      adjustment: adjustmentRecord
    };
  } catch (error) {
    return { success: false, error: `Failed to adjust inventory: ${error}` };
  }
}

/**
 * Calculate total available quantity for a SKU across all locations
 */
export async function getTotalAvailableQuantity(skuId: string, locationIds?: string[]): Promise<number> {
  const filters: InventoryFilters = { sku_id: skuId, status: "active" };
  if (locationIds) {
    filters.location_id = locationIds;
  }
  
  const inventoryRecords = await listInventory(filters);
  
  return inventoryRecords.reduce((total, inv) => {
    return total + Math.max(0, inv.quantities.available);
  }, 0);
}

/**
 * Get inventory summary by location
 */
export async function getInventorySummaryByLocation(locationId: string): Promise<{
  location_id: string;
  total_skus: number;
  in_stock_skus: number;
  out_of_stock_skus: number;
  low_stock_skus: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  total_incoming: number;
}> {
  const inventoryRecords = await getInventoryByLocation(locationId);
  
  const summary = inventoryRecords.reduce((acc, inv) => {
    acc.total_on_hand += inv.quantities.on_hand;
    acc.total_reserved += inv.quantities.reserved;
    acc.total_available += Math.max(0, inv.quantities.available);
    acc.total_incoming += inv.quantities.incoming || 0;
    
    if (inv.stock_status === "in_stock") acc.in_stock_skus++;
    if (inv.stock_status === "out_of_stock") acc.out_of_stock_skus++;
    if (inv.quantities.available <= 10) acc.low_stock_skus++; // Using 10 as default low stock threshold
    
    return acc;
  }, {
    location_id: locationId,
    total_skus: inventoryRecords.length,
    in_stock_skus: 0,
    out_of_stock_skus: 0,
    low_stock_skus: 0,
    total_on_hand: 0,
    total_reserved: 0,
    total_available: 0,
    total_incoming: 0
  });
  
  return summary;
}

/**
 * Get inventory trends (would typically require time-series data)
 */
export async function getInventoryTrends(skuId: string, locationId?: string, days: number = 30): Promise<{
  sku_id: string;
  location_id?: string;
  period_days: number;
  // In real implementation, these would come from historical tracking
  average_daily_demand: number;
  stockout_days: number;
  turnover_rate: number;
  forecast_demand: number;
}> {
  // This is a simplified example - real implementation would need historical data
  const filters: InventoryFilters = { sku_id: skuId };
  if (locationId) {
    filters.location_id = locationId;
  }
  
  const currentInventory = await listInventory(filters);
  
  // Mock calculations - in reality, you'd query historical data
  return {
    sku_id: skuId,
    location_id: locationId,
    period_days: days,
    average_daily_demand: 5, // Mock value
    stockout_days: 2, // Mock value
    turnover_rate: 0.85, // Mock value
    forecast_demand: 150 // Mock value
  };
}
