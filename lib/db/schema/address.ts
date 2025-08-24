/**
 * MACH Alliance Open Data Model - Address Schema
 * Drizzle ORM schema definition for Cloudflare D1
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/address.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Address } from "@/lib/types";

/**
 * Addresses table - MACH Alliance compliant address storage
 * 
 * Used as utility object within other entities and for standalone
 * address management (customer addresses, shipping destinations, etc.)
 */
export const addresses = sqliteTable("addresses", {
  // Core identification
  id: text("id").primaryKey(),
  
  // Classification with enum constraints
  type: text("type", { 
    enum: ["shipping", "billing", "business", "residential", "mailing", "pickup"] 
  }).default("shipping"),
  status: text("status", { 
    enum: ["active", "invalid", "undeliverable", "verified", "unverified"] 
  }).default("unverified"),
  
  // Required fields (MUST have according to MACH spec)
  line1: text("line1").notNull(), // Primary address line
  city: text("city").notNull(),   // City, town, or locality name  
  country: text("country").notNull(), // ISO 3166-1 alpha-2 country code
  
  // Optional address lines
  line2: text("line2"), // Secondary address line (apartment, suite, unit)
  line3: text("line3"), // Additional address line (building, complex name)
  line4: text("line4"), // Extra address line for complex addresses
  
  // Location components
  district: text("district"), // District, neighborhood, or borough
  region: text("region"),     // State, province, or administrative region
  postalCode: text("postal_code"), // Postal code, ZIP code, or postcode
  
  // Geographic data (stored as JSON for coordinates object)
  coordinates: text("coordinates"), // JSON: {latitude, longitude, altitude?, accuracy?}
  formatted: text("formatted"),     // Pre-formatted complete address string
  
  // Contact information
  company: text("company"),   // Company or organization name
  recipient: text("recipient"), // Recipient name for delivery
  phone: text("phone"),       // Contact phone number (E.164 format recommended)
  email: text("email"),       // Contact email for delivery notifications
  
  // Delivery details
  deliveryInstructions: text("delivery_instructions"), // Special delivery instructions
  accessCodes: text("access_codes"), // Gate codes, building access information
  
  // Validation metadata (stored as JSON)
  validation: text("validation"), // JSON: validation object with provider, confidence_score, etc.
  
  // Additional attributes (stored as JSON)
  attributes: text("attributes"), // JSON: Additional address-specific attributes
  
  // Timestamps
  createdAt: text("created_at"), // ISO 8601 creation timestamp
  updatedAt: text("updated_at"), // ISO 8601 update timestamp  
  verifiedAt: text("verified_at"), // ISO 8601 verification timestamp
  
  // Extensions (stored as JSON)
  extensions: text("extensions"), // JSON: Namespaced dictionary for extension data
});

/**
 * Type for inserting new addresses
 */
export type InsertAddress = typeof addresses.$inferInsert;

/**
 * Type for selecting addresses from database
 */
export type SelectAddress = typeof addresses.$inferSelect;

// Helper: parse stringified JSON or return as-is
function parseMaybeJson(val: any) {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// Helper: convert DB record to MACH Address
export function deserializeAddress(record: SelectAddress): Address {
  return {
    id: record.id ?? undefined,
    type: record.type ?? undefined,
    status: record.status ?? undefined,
    line1: parseMaybeJson(record.line1),
    city: parseMaybeJson(record.city),
    country: record.country,
    line2: record.line2 ? parseMaybeJson(record.line2) : undefined,
    line3: record.line3 ? parseMaybeJson(record.line3) : undefined,
    line4: record.line4 ? parseMaybeJson(record.line4) : undefined,
    district: record.district ? parseMaybeJson(record.district) : undefined,
    region: record.region ?? undefined,
    postal_code: record.postalCode ?? undefined,
    coordinates: record.coordinates ? JSON.parse(record.coordinates) : undefined,
    formatted: record.formatted ? parseMaybeJson(record.formatted) : undefined,
    company: record.company ?? undefined,
    recipient: record.recipient ?? undefined,
    phone: record.phone ?? undefined,
    email: record.email ?? undefined,
    delivery_instructions: record.deliveryInstructions ? parseMaybeJson(record.deliveryInstructions) : undefined,
    access_codes: record.accessCodes ?? undefined,
    validation: record.validation ? JSON.parse(record.validation) : undefined,
    attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
    created_at: record.createdAt ?? undefined,
    updated_at: record.updatedAt ?? undefined,
    verified_at: record.verifiedAt ?? undefined,
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
  };
}

// Helper: convert MACH Address to DB insert format
export function serializeAddress(address: Address): InsertAddress {
  return {
    id: address.id ?? `addr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: address.type ?? "shipping",
    status: address.status ?? "unverified",
    line1: typeof address.line1 === 'string' ? address.line1 : JSON.stringify(address.line1),
    city: typeof address.city === 'string' ? address.city : JSON.stringify(address.city),
    country: address.country,
    line2: address.line2 ? (typeof address.line2 === 'string' ? address.line2 : JSON.stringify(address.line2)) : undefined,
    line3: address.line3 ? (typeof address.line3 === 'string' ? address.line3 : JSON.stringify(address.line3)) : undefined,
    line4: address.line4 ? (typeof address.line4 === 'string' ? address.line4 : JSON.stringify(address.line4)) : undefined,
    district: address.district ? (typeof address.district === 'string' ? address.district : JSON.stringify(address.district)) : undefined,
    region: address.region,
    postalCode: address.postal_code,
    coordinates: address.coordinates ? JSON.stringify(address.coordinates) : undefined,
    formatted: address.formatted ? (typeof address.formatted === 'string' ? address.formatted : JSON.stringify(address.formatted)) : undefined,
    company: address.company,
    recipient: address.recipient,
    phone: address.phone,
    email: address.email,
    deliveryInstructions: address.delivery_instructions ? (typeof address.delivery_instructions === 'string' ? address.delivery_instructions : JSON.stringify(address.delivery_instructions)) : undefined,
    accessCodes: address.access_codes,
    validation: address.validation ? JSON.stringify(address.validation) : undefined,
    attributes: address.attributes ? JSON.stringify(address.attributes) : undefined,
    createdAt: address.created_at ?? new Date().toISOString(),
    updatedAt: address.updated_at ?? new Date().toISOString(),
    verifiedAt: address.verified_at,
    extensions: address.extensions ? JSON.stringify(address.extensions) : undefined,
  };
}
