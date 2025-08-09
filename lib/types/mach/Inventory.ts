/**
 * MACH Alliance Open Data Model - Inventory
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/inventory/inventory.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

/**
 * MACH Alliance Open Data Model - Inventory Entity v1.0
 * 
 * Holds the real-time, location-level stock picture for a single SKU so every
 * channel can make consistent availability, reservation, and fulfillment decisions.
 */
export interface MACHInventory {
  // Core identification - REQUIRED
  id: string;
  sku_id: string; // Reference to the SKU/product variant
  location_id: string; // Reference to the inventory location
  quantities: MACHInventoryQuantities;

  // Status and state - OPTIONAL
  status?: "draft" | "active" | "inactive";
  stock_status?: "in_stock" | "out_of_stock" | "backorder" | "preorder";
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601

  // Policy and rules - OPTIONAL
  policy_id?: string; // Reference to the inventory policy ruleset
  backorderable?: boolean;
  backorder_eta?: string; // ISO 8601
  safety_stock?: number;

  // Concurrency control - OPTIONAL
  version?: number; // For optimistic concurrency control

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Stock quantities breakdown
 */
export interface MACHInventoryQuantities {
  // Core quantities - REQUIRED
  on_hand: number; // Physical stock currently in the location
  reserved: number; // Quantity allocated to orders but not yet fulfilled
  available: number; // Quantity available for new orders (on_hand - reserved - safety_stock)

  // Additional quantities - OPTIONAL
  incoming?: number; // Quantity expected from purchase orders or transfers
  allocated?: number; // Quantity soft-reserved in carts or quotes
  damaged?: number; // Quantity marked as damaged/unsellable
}

/**
 * Inventory location information
 */
export interface MACHInventoryLocation {
  id: string;
  type: "warehouse" | "store" | "3pl" | "dropship" | "virtual";
  name: string;
  address?: any; // Reference to Address utility
}

/**
 * Inventory policy ruleset
 */
export interface MACHInventoryPolicy {
  id: string;
  name: string;
  allow_backorder: boolean;
  max_backorder_quantity?: number;
  safety_stock_percentage?: number; // 0-100
}

// Type guards for inventory status
export function isInStock(inventory: MACHInventory): boolean {
  return inventory.stock_status === "in_stock";
}

export function isBackorderable(inventory: MACHInventory): boolean {
  return inventory.backorderable === true;
}

export function hasAvailableStock(inventory: MACHInventory): boolean {
  return inventory.quantities.available > 0;
}

// Sample objects for reference

/**
 * Sample minimal inventory
 */
export const sampleMinimalInventory: MACHInventory = {
  id: "INV-001",
  sku_id: "SKU-BASIC-TEE",
  location_id: "LOC-MAIN",
  quantities: {
    on_hand: 50,
    reserved: 5,
    available: 45
  },
  stock_status: "in_stock"
};

/**
 * Sample full inventory record
 */
export const sampleFullInventory: MACHInventory = {
  id: "INV-SKU-123-LOC-DC-TOR",
  sku_id: "SKU-123",
  location_id: "LOC-DC-TOR",
  status: "active",
  stock_status: "in_stock",
  external_references: {
    wms_id: "WMS-INV-77812",
    erp_id: "SAP-100045-TOR"
  },
  created_at: "2024-03-12T09:00:00Z",
  updated_at: "2024-06-22T16:30:00Z",
  quantities: {
    on_hand: 120,
    reserved: 15,
    available: 95,
    incoming: 40,
    allocated: 3,
    damaged: 2
  },
  policy_id: "POLICY-STD",
  backorderable: true,
  backorder_eta: "2024-07-10T00:00:00Z",
  safety_stock: 10,
  version: 4,
  extensions: {
    forecast: {
      next_30_days_demand: 90,
      confidence: 0.85
    },
    warehouse: {
      zone: "A-12",
      bin: "A-12-03",
      last_cycle_count: "2024-06-15T08:00:00Z"
    },
    demand_signals: {
      last_24h_add_to_carts: 12,
      velocity_trend: "increasing"
    }
  }
};

/**
 * Sample backorder scenario
 */
export const sampleBackorderInventory: MACHInventory = {
  id: "INV-POPULAR-ITEM-MAIN",
  sku_id: "POPULAR-ITEM-001",
  location_id: "LOC-MAIN",
  status: "active",
  stock_status: "backorder",
  quantities: {
    on_hand: 0,
    reserved: 45,
    available: -45,
    incoming: 200,
    allocated: 12
  },
  backorderable: true,
  backorder_eta: "2024-07-15T00:00:00Z",
  external_references: {
    po_number: "PO-2024-789",
    supplier_id: "SUPP-123"
  },
  extensions: {
    backorder: {
      max_backorder_quantity: 100,
      current_backorders: 45,
      estimated_ship_date: "2024-07-17T00:00:00Z"
    },
    alerts: {
      low_stock_triggered: "2024-06-20T14:30:00Z",
      out_of_stock_triggered: "2024-06-22T09:15:00Z"
    }
  }
};

/**
 * Sample multi-location inventory (array example)
 */
export const sampleMultiLocationInventory: MACHInventory[] = [
  {
    id: "INV-TSHIRT-001-DC-EAST",
    sku_id: "TSHIRT-001",
    location_id: "DC-EAST",
    quantities: {
      on_hand: 500,
      reserved: 125,
      available: 375
    },
    stock_status: "in_stock",
    policy_id: "POLICY-DC"
  },
  {
    id: "INV-TSHIRT-001-DC-WEST",
    sku_id: "TSHIRT-001",
    location_id: "DC-WEST",
    quantities: {
      on_hand: 300,
      reserved: 200,
      available: 100
    },
    stock_status: "in_stock",
    policy_id: "POLICY-DC"
  },
  {
    id: "INV-TSHIRT-001-STORE-NYC",
    sku_id: "TSHIRT-001",
    location_id: "STORE-NYC",
    quantities: {
      on_hand: 25,
      reserved: 0,
      available: 20
    },
    stock_status: "in_stock",
    safety_stock: 5,
    policy_id: "POLICY-STORE"
  }
];
