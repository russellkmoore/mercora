/**
 * MACH Alliance Open Data Model - Address Schema
 * Drizzle ORM schema definition for Cloudflare D1
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/address.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { MACHAddress } from "@/lib/types/mach/Address";

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

/**
 * Transform database record to MACH Address interface
 */
export function transformToMACHAddress(record: SelectAddress): MACHAddress {
  return {
    id: record.id ?? undefined,
    type: record.type ?? undefined,
    status: record.status ?? undefined,
    line1: record.line1,
    city: record.city,
    country: record.country,
    line2: record.line2 ?? undefined,
    line3: record.line3 ?? undefined,
    line4: record.line4 ?? undefined,
    district: record.district ?? undefined,
    region: record.region ?? undefined,
    postal_code: record.postalCode ?? undefined,
    coordinates: record.coordinates ? JSON.parse(record.coordinates) : undefined,
    formatted: record.formatted ?? undefined,
    company: record.company ?? undefined,
    recipient: record.recipient ?? undefined,
    phone: record.phone ?? undefined,
    email: record.email ?? undefined,
    delivery_instructions: record.deliveryInstructions ?? undefined,
    access_codes: record.accessCodes ?? undefined,
    validation: record.validation ? JSON.parse(record.validation) : undefined,
    attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
    created_at: record.createdAt ?? undefined,
    updated_at: record.updatedAt ?? undefined,
    verified_at: record.verifiedAt ?? undefined,
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
  };
}

/**
 * Transform MACH Address to database insert format
 */
export function transformFromMACHAddress(address: MACHAddress): InsertAddress {
  return {
    id: address.id ?? `addr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: address.type ?? "shipping",
    status: address.status ?? "unverified",
    line1: address.line1 as string, // Handle localization by storing JSON
    city: address.city as string,   // Handle localization by storing JSON  
    country: address.country,
    line2: address.line2 as string | undefined,
    line3: address.line3 as string | undefined,
    line4: address.line4 as string | undefined,
    district: address.district as string | undefined,
    region: address.region,
    postalCode: address.postal_code,
    coordinates: address.coordinates ? JSON.stringify(address.coordinates) : undefined,
    formatted: address.formatted as string | undefined,
    company: address.company,
    recipient: address.recipient,
    phone: address.phone,
    email: address.email,
    deliveryInstructions: address.delivery_instructions as string | undefined,
    accessCodes: address.access_codes,
    validation: address.validation ? JSON.stringify(address.validation) : undefined,
    attributes: address.attributes ? JSON.stringify(address.attributes) : undefined,
    createdAt: address.created_at ?? new Date().toISOString(),
    updatedAt: address.updated_at ?? new Date().toISOString(),
    verifiedAt: address.verified_at,
    extensions: address.extensions ? JSON.stringify(address.extensions) : undefined,
  };
}
