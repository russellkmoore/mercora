import type { CartItem } from "./cartitem";
import type { ShippingOption } from "./shipping";
// lib/types/order.ts - MACH Alliance Order Types
import type { BillingInfo } from "./billing";

// lib/types/order.ts - MACH Alliance Order Types

// Standard Money type used throughout MACH Alliance
export interface Money {
  amount: number; // Amount in smallest currency unit (e.g., cents)
  currency: string; // ISO 4217 currency code
}

// Address type for billing and shipping
export interface Address {
  id?: string;
  type?: "billing" | "shipping";
  first_name?: string;
  last_name?: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string; // ISO 3166-1 alpha-2
  phone?: string;
}

// Product variant option values (e.g., size: "Large", color: "Red")
export interface VariantOption {
  option_name: string;
  option_value: string;
}

// Individual item within an order
export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  variant_id?: string;
  sku: string;
  quantity: number;
  unit_price: Money;
  total_price: Money;
  product_name: string;
  variant_options?: VariantOption[];
  created_at?: string;
}

// Order status enumeration
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

// Payment status enumeration  
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

// Core Order interface - MACH Alliance compliant
export interface Order {
  id?: string;
  customer_id?: string;
  
  // Order status and lifecycle
  status: OrderStatus;
  
  // Financial information
  total_amount: Money;
  currency_code: string; // ISO 4217
  
  // Addresses
  shipping_address?: Address;
  billing_address?: Address;
  
  // Order items
  items: OrderItem[];
  
  // Shipping and payment
  shipping_method?: string;
  payment_method?: string;
  payment_status: PaymentStatus;
  
  // Tracking and fulfillment
  tracking_number?: string;
  shipped_at?: string; // ISO 8601 timestamp
  delivered_at?: string; // ISO 8601 timestamp
  
  // Additional metadata
  notes?: string;
  external_references?: Record<string, any>; // External system references
  extensions?: Record<string, any>; // Custom extensions
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Order creation request interface
export interface CreateOrderRequest {
  customer_id?: string;
  items: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[];
  total_amount: Money;
  currency_code: string;
  shipping_address?: Address;
  billing_address?: Address;
  shipping_method?: string;
  payment_method?: string;
  notes?: string;
  external_references?: Record<string, any>;
  extensions?: Record<string, any>;
}

// Order update request interface
export interface UpdateOrderRequest {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  shipping_method?: string;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  external_references?: Record<string, any>;
  extensions?: Record<string, any>;
}

// Webhook types
export type WebhookType = 
  | "order_created"
  | "order_updated"
  | "payment_completed"
  | "shipment_created"
  | "delivery_confirmed";

export type WebhookStatus = 
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retrying";

export interface OrderWebhook {
  id?: string;
  order_id: string;
  webhook_type: WebhookType;
  status: WebhookStatus;
  payload: Record<string, any>;
  response?: Record<string, any>;
  endpoint_url?: string;
  attempts: number;
  max_attempts: number;
  next_retry_at?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

// Legacy support - map old types to new structure for backward compatibility
export interface LegacyOrder {
  id?: string;
  userId?: string; // Maps to customer_id
  email?: string; // Stored in customer record
  items: any[]; // Legacy items format
  shippingAddress?: any; // Legacy address format
  billingAddress?: any; // Legacy address format  
  shippingOption?: any; // Legacy shipping format
  shippingCost?: number; // Part of total_amount
  billingInfo?: any; // Legacy billing format
  taxAmount?: number; // Part of total_amount
  total?: number; // Maps to total_amount.amount
  status?: string; // Maps to OrderStatus
  
  // Legacy tracking fields
  carrier?: string; // Maps to shipping_method
  trackingNumber?: string; // Maps to tracking_number
  trackingUrl?: string; // Stored in extensions
  shippedAt?: string; // Maps to shipped_at
  deliveredAt?: string; // Maps to delivered_at
  
  // Legacy metadata
  cancellationReason?: string; // Stored in notes or extensions
  notes?: string; // Maps to notes
  
  createdAt?: string; // Maps to created_at
  updatedAt?: string; // Maps to updated_at
}

// Utility functions for converting between legacy and MACH formats
export function convertLegacyToMach(legacyOrder: LegacyOrder): Order {
  return {
    id: legacyOrder.id,
    customer_id: legacyOrder.userId,
    status: mapLegacyStatus(legacyOrder.status),
    total_amount: {
      amount: legacyOrder.total || 0,
      currency: "USD" // Default currency
    },
    currency_code: "USD",
    shipping_address: legacyOrder.shippingAddress,
    billing_address: legacyOrder.billingAddress,
    items: legacyOrder.items || [],
    shipping_method: legacyOrder.carrier,
    payment_method: "card", // Default
    payment_status: "pending", // Default
    tracking_number: legacyOrder.trackingNumber,
    shipped_at: legacyOrder.shippedAt,
    delivered_at: legacyOrder.deliveredAt,
    notes: legacyOrder.notes || legacyOrder.cancellationReason,
    extensions: {
      trackingUrl: legacyOrder.trackingUrl,
      email: legacyOrder.email,
      shippingCost: legacyOrder.shippingCost,
      taxAmount: legacyOrder.taxAmount,
    },
    created_at: legacyOrder.createdAt,
    updated_at: legacyOrder.updatedAt,
  };
}

function mapLegacyStatus(legacyStatus?: string): OrderStatus {
  switch (legacyStatus) {
    case "incomplete":
    case "pending":
      return "pending";
    case "paid":
    case "processing":
      return "processing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function convertMachToLegacy(machOrder: Order): LegacyOrder {
  return {
    id: machOrder.id,
    userId: machOrder.customer_id,
    email: machOrder.extensions?.email,
    items: machOrder.items,
    shippingAddress: machOrder.shipping_address,
    billingAddress: machOrder.billing_address,
    shippingCost: machOrder.extensions?.shippingCost,
    taxAmount: machOrder.extensions?.taxAmount,
    total: machOrder.total_amount.amount,
    status: machOrder.status,
    carrier: machOrder.shipping_method,
    trackingNumber: machOrder.tracking_number,
    trackingUrl: machOrder.extensions?.trackingUrl,
    shippedAt: machOrder.shipped_at,
    deliveredAt: machOrder.delivered_at,
    notes: machOrder.notes,
    createdAt: machOrder.created_at,
    updatedAt: machOrder.updated_at,
  };
}