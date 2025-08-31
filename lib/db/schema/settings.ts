// lib/db/schema/settings.ts - Admin Settings Schema

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Admin Settings Table - Stores configurable system settings
 * Key-value store for various configuration options
 */
export const admin_settings = sqliteTable("admin_settings", {
  key: text("key").primaryKey(), // Setting identifier
  value: text("value").notNull(), // JSON string value
  category: text("category").notNull(), // system, store, shipping, refund, promotions
  description: text("description"), // Human-readable description
  data_type: text("data_type").notNull(), // string, number, boolean, object
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// Default settings for new installations
export const defaultSettings = [
  // System Operations
  {
    key: 'system.maintenance_mode',
    value: JSON.stringify(false),
    category: 'system',
    description: 'Block public access (admin still accessible)',
    data_type: 'boolean'
  },
  {
    key: 'system.maintenance_message',
    value: JSON.stringify('We\'re making some improvements! We\'ll be back soon.'),
    category: 'system',
    description: 'Message shown during maintenance',
    data_type: 'string'
  },
  {
    key: 'system.debug_mode',
    value: JSON.stringify(false),
    category: 'system',
    description: 'Enable detailed error logging',
    data_type: 'boolean'
  },
  
  // Store Operations
  {
    key: 'store.free_shipping_threshold',
    value: JSON.stringify(75),
    category: 'store',
    description: 'Minimum order amount for free shipping ($)',
    data_type: 'number'
  },
  {
    key: 'store.tax_rate',
    value: JSON.stringify(8.25),
    category: 'store',
    description: 'Default tax rate percentage',
    data_type: 'number'
  },
  {
    key: 'store.auto_fulfill_orders',
    value: JSON.stringify(true),
    category: 'store',
    description: 'Automatically fulfill orders vs manual review',
    data_type: 'boolean'
  },
  
  
  // Shipping Configuration
  {
    key: 'shipping.methods',
    value: JSON.stringify([
      { id: 'standard', label: 'Standard (5–7 days)', cost: 5.99, estimatedDays: 5, enabled: true },
      { id: 'express', label: 'Express (2–3 days)', cost: 9.99, estimatedDays: 2, enabled: true },
      { id: 'overnight', label: 'Overnight', cost: 19.99, estimatedDays: 1, enabled: true }
    ]),
    category: 'shipping',
    description: 'Available shipping methods and pricing',
    data_type: 'object'
  },
  {
    key: 'shipping.free_methods',
    value: JSON.stringify(['standard']),
    category: 'shipping',
    description: 'Which methods become free over threshold',
    data_type: 'object'
  },
  
  // Refund Policy Settings (Default: Don\'t refund shipping - industry standard)
  {
    key: 'refund.shipping_refunded_partial',
    value: JSON.stringify(false),
    category: 'refund',
    description: 'Refund shipping costs on partial returns',
    data_type: 'boolean'
  },
  {
    key: 'refund.shipping_refunded_full',
    value: JSON.stringify(false),
    category: 'refund', 
    description: 'Refund shipping costs on full returns',
    data_type: 'boolean'
  },
  {
    key: 'refund.restocking_fee_percent',
    value: JSON.stringify(0),
    category: 'refund',
    description: 'Restocking fee percentage (0-15)',
    data_type: 'number'
  },
  {
    key: 'refund.return_window_days',
    value: JSON.stringify(30),
    category: 'refund',
    description: 'Return window in days',
    data_type: 'number'
  },
  {
    key: 'refund.minimum_refund_amount',
    value: JSON.stringify(500),
    category: 'refund',
    description: 'Minimum refund amount in cents ($5.00)',
    data_type: 'number'
  },
  
  // Promotions & Banners
  {
    key: 'promotions.site_wide_discount_percent',
    value: JSON.stringify(0),
    category: 'promotions',
    description: 'Global discount percentage (0-50)',
    data_type: 'number'
  },
  {
    key: 'promotions.banner_enabled',
    value: JSON.stringify(false),
    category: 'promotions',
    description: 'Show promotional banner',
    data_type: 'boolean'
  },
  {
    key: 'promotions.banner_text',
    value: JSON.stringify('🎉 Free shipping on orders over $75!'),
    category: 'promotions',
    description: 'Banner message text',
    data_type: 'string'
  },
  {
    key: 'promotions.banner_type',
    value: JSON.stringify('info'),
    category: 'promotions',
    description: 'Banner style: info, warning, success, error',
    data_type: 'string'
  },
  {
    key: 'promotions.new_customer_discount',
    value: JSON.stringify(0),
    category: 'promotions',
    description: 'First-time buyer discount percentage',
    data_type: 'number'
  }
];