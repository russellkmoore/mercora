/**
 * MACH Alliance Open Data Model - Customer Schema
 * Drizzle ORM schema definition for Cloudflare D1
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/identity/customer.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Customer } from "@/lib/types";

/**
 * Customers table - MACH Alliance compliant customer storage
 * 
 * Supports both B2B (company) and B2C (person) customers with comprehensive
 * identity, contact, and preference management
 */
export const customers = sqliteTable("customers", {
  // Core identification - REQUIRED
  id: text("id").primaryKey(),
  type: text("type", { 
    enum: ["person", "company"] 
  }).notNull(),
  
  // Status and lifecycle - OPTIONAL
  status: text("status", { 
    enum: ["active", "inactive", "suspended", "archived", "pending_verification"] 
  }).default("active"),
  externalReferences: text("external_references"), // JSON: Dictionary of cross-system IDs
  
  // Timestamps - OPTIONAL
  createdAt: text("created_at"), // ISO 8601 creation timestamp
  updatedAt: text("updated_at"), // ISO 8601 update timestamp
  
  // Person-specific data (B2C) - OPTIONAL
  person: text("person"), // JSON: MACHPersonData object
  
  // Company-specific data (B2B) - OPTIONAL  
  company: text("company"), // JSON: MACHCompanyData object
  
  // Contact persons (primarily for B2B) - OPTIONAL
  contacts: text("contacts"), // JSON: Array of MACHContactPerson objects
  
  // Addresses - OPTIONAL
  addresses: text("addresses"), // JSON: Array of MACHCustomerAddress objects
  
  // Communication preferences - OPTIONAL
  communicationPreferences: text("communication_preferences"), // JSON: MACHCommunicationPreferences object
  
  // Segmentation - OPTIONAL
  segments: text("segments"), // JSON: Array of segment strings
  tags: text("tags"), // JSON: Array of tag strings
  
  // Loyalty information - OPTIONAL
  loyalty: text("loyalty"), // JSON: MACHLoyaltyInfo object
  
  // Authentication settings - OPTIONAL
  authentication: text("authentication"), // JSON: MACHAuthenticationSettings object
  
  // Extensions - OPTIONAL
  extensions: text("extensions"), // JSON: Namespaced dictionary for extension data
});

/**
 * Type for inserting new customers
 */
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Type for selecting customers from database
 */
export type SelectCustomer = typeof customers.$inferSelect;

/**
 * Helper: convert DB record to MACH Customer
 */
export function deserializeCustomer(record: SelectCustomer): Customer {
  return {
    id: record.id,
    type: record.type as "person" | "company",
    status: record.status as "active" | "inactive" | "suspended" | "archived" | "pending_verification" | undefined,
    external_references: record.externalReferences ? JSON.parse(record.externalReferences) : undefined,
    created_at: record.createdAt || undefined,
    updated_at: record.updatedAt || undefined,
    person: record.person ? JSON.parse(record.person) : undefined,
    company: record.company ? JSON.parse(record.company) : undefined,
    contacts: record.contacts ? JSON.parse(record.contacts) : undefined,
    addresses: record.addresses ? JSON.parse(record.addresses) : undefined,
    communication_preferences: record.communicationPreferences ? JSON.parse(record.communicationPreferences) : undefined,
    segments: record.segments ? JSON.parse(record.segments) : undefined,
    tags: record.tags ? JSON.parse(record.tags) : undefined,
    loyalty: record.loyalty ? JSON.parse(record.loyalty) : undefined,
    authentication: record.authentication ? JSON.parse(record.authentication) : undefined,
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
  };
}

/**
 * Helper: convert MACH Customer to DB insert format
 */
export function serializeCustomer(customer: Customer): InsertCustomer {
  return {
    id: customer.id,
    type: customer.type,
    status: customer.status || "active",
    externalReferences: customer.external_references ? JSON.stringify(customer.external_references) : undefined,
    createdAt: customer.created_at || new Date().toISOString(),
    updatedAt: customer.updated_at || new Date().toISOString(),
    person: customer.person ? JSON.stringify(customer.person) : undefined,
    company: customer.company ? JSON.stringify(customer.company) : undefined,
    contacts: customer.contacts ? JSON.stringify(customer.contacts) : undefined,
    addresses: customer.addresses ? JSON.stringify(customer.addresses) : undefined,
    communicationPreferences: customer.communication_preferences ? JSON.stringify(customer.communication_preferences) : undefined,
    segments: customer.segments ? JSON.stringify(customer.segments) : undefined,
    tags: customer.tags ? JSON.stringify(customer.tags) : undefined,
    loyalty: customer.loyalty ? JSON.stringify(customer.loyalty) : undefined,
    authentication: customer.authentication ? JSON.stringify(customer.authentication) : undefined,
    extensions: customer.extensions ? JSON.stringify(customer.extensions) : undefined,
  };
}

/**
 * Helper function to check if a string is valid JSON
 */
function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
