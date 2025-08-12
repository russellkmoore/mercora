/**
 * MACH Alliance Open Data Model - Address Model
 * 
 * Business logic and CRUD operations for address management
 * following the MACH Alliance Address utility object specification.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/address.md
 */

import { getDbAsync } from "@/lib/db";
import { addresses } from "@/lib/db/schema/address";
import { eq, desc, asc, like, or, and, inArray } from "drizzle-orm";
import type { Address, Coordinates, AddressValidation } from "@/lib/types";

// Address creation input type
export interface CreateAddressInput {
  // Required fields
  line1: string | Record<string, string>; // Primary address line (localizable)
  city: string | Record<string, string>; // City, town, or locality (localizable)
  country: string; // ISO 3166-1 alpha-2 country code
  
  // Optional classification
  type?: "shipping" | "billing" | "business" | "residential" | "mailing" | "pickup";
  status?: "active" | "invalid" | "undeliverable" | "verified" | "unverified";
  
  // Optional address components
  line2?: string | Record<string, string>; // Secondary address line
  line3?: string | Record<string, string>; // Additional address line
  line4?: string | Record<string, string>; // Extra address line
  district?: string | Record<string, string>; // District, neighborhood
  region?: string; // State, province, or administrative region
  postal_code?: string; // Postal code, ZIP code, or postcode
  
  // Geographic and formatting
  coordinates?: Coordinates;
  formatted?: string | Record<string, string>; // Pre-formatted address
  
  // Contact information
  company?: string;
  recipient?: string;
  phone?: string; // E.164 format recommended
  email?: string;
  
  // Delivery details
  delivery_instructions?: string | Record<string, string>;
  access_codes?: string;
  
  // Validation and metadata
  validation?: AddressValidation;
  attributes?: Record<string, any>;
  
  // Extensions
  extensions?: Record<string, any>;
}

// Address update input type
export interface UpdateAddressInput extends Partial<CreateAddressInput> {
  id: string;
}

// Address filter options
export interface AddressFilters {
  type?: "shipping" | "billing" | "business" | "residential" | "mailing" | "pickup" | "shipping" | "billing" | "business" | "residential" | "mailing" | "pickup"[];
  status?: "active" | "invalid" | "undeliverable" | "verified" | "unverified" | "active" | "invalid" | "undeliverable" | "verified" | "unverified"[];
  country?: string | string[]; // ISO 3166-1 alpha-2
  region?: string | string[];
  city?: string;
  postal_code?: string;
  recipient?: string;
  company?: string;
  search?: string; // General text search across multiple fields
  verified?: boolean; // Filter by verification status
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'verified_at' | 'recipient' | 'company' | 'country' | 'city';
  sortOrder?: 'asc' | 'desc';
}

// Address validation result
export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: Partial<Address>;
  standardized?: Address;
}

/**
 * Generate a unique address ID
 */
function generateAddressId(): string {
  return `addr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate address data according to MACH Alliance standards
 */
export function validateAddress(address: Partial<Address>): AddressValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!address.line1 || (typeof address.line1 === 'object' && Object.keys(address.line1).length === 0)) {
    errors.push("line1 is required");
  }
  
  if (!address.city || (typeof address.city === 'object' && Object.keys(address.city).length === 0)) {
    errors.push("city is required");
  }
  
  if (!address.country) {
    errors.push("country is required");
  } else if (address.country.length !== 2) {
    errors.push("country must be ISO 3166-1 alpha-2 format (2 characters)");
  }
  
  // Optional field validation
  if (address.phone && !address.phone.startsWith('+')) {
    warnings.push("phone should use E.164 format (starting with +)");
  }
  
  if (address.email && !address.email.includes('@')) {
    errors.push("email must be a valid email address");
  }
  
  if (address.coordinates) {
    const { latitude, longitude } = address.coordinates;
    if (latitude < -90 || latitude > 90) {
      errors.push("coordinates.latitude must be between -90 and 90");
    }
    if (longitude < -180 || longitude > 180) {
      errors.push("coordinates.longitude must be between -180 and 180");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper: parse stringified JSON or return as-is
function parseMaybeJson(val: any) {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// Helper: convert DB record to MACHAddress
function deserializeAddress(record: any): Address {
  return {
    id: record.id,
    line1: parseMaybeJson(record.line1),
    city: parseMaybeJson(record.city),
    country: record.country,
    type: record.type,
    status: record.status,
    line2: record.line2 ? parseMaybeJson(record.line2) : undefined,
    line3: record.line3 ? parseMaybeJson(record.line3) : undefined,
    line4: record.line4 ? parseMaybeJson(record.line4) : undefined,
    district: record.district ? parseMaybeJson(record.district) : undefined,
    region: record.region,
    postal_code: record.postalCode,
    coordinates: record.coordinates ? JSON.parse(record.coordinates) : undefined,
    formatted: record.formatted ? parseMaybeJson(record.formatted) : undefined,
    company: record.company,
    recipient: record.recipient,
    phone: record.phone,
    email: record.email,
    delivery_instructions: record.deliveryInstructions ? parseMaybeJson(record.deliveryInstructions) : undefined,
    access_codes: record.accessCodes,
    validation: record.validation ? JSON.parse(record.validation) : undefined,
    attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
    verified_at: record.verifiedAt,
  };
}

/**
 * Create a new address
 */
export async function createAddress(input: CreateAddressInput): Promise<Address> {
  const id = generateAddressId();
  const now = new Date().toISOString();
  
  // Validate before creating
  const validation = validateAddress(input as Address);
  if (!validation.isValid) {
    throw new Error(`Address validation failed: ${validation.errors.join(', ')}`);
  }
  
  const dbRecord = {
    id,
    line1: typeof input.line1 === 'string' ? input.line1 : JSON.stringify(input.line1),
    city: typeof input.city === 'string' ? input.city : JSON.stringify(input.city),
    country: input.country,
    type: input.type ?? "shipping",
    status: input.status ?? "unverified",
    line2: input.line2 ? (typeof input.line2 === 'string' ? input.line2 : JSON.stringify(input.line2)) : undefined,
    line3: input.line3 ? (typeof input.line3 === 'string' ? input.line3 : JSON.stringify(input.line3)) : undefined,
    line4: input.line4 ? (typeof input.line4 === 'string' ? input.line4 : JSON.stringify(input.line4)) : undefined,
    district: input.district ? (typeof input.district === 'string' ? input.district : JSON.stringify(input.district)) : undefined,
    region: input.region,
    postalCode: input.postal_code,
    coordinates: input.coordinates ? JSON.stringify(input.coordinates) : undefined,
    formatted: input.formatted ? (typeof input.formatted === 'string' ? input.formatted : JSON.stringify(input.formatted)) : undefined,
    company: input.company,
    recipient: input.recipient,
    phone: input.phone,
    email: input.email,
    deliveryInstructions: input.delivery_instructions ? (typeof input.delivery_instructions === 'string' ? input.delivery_instructions : JSON.stringify(input.delivery_instructions)) : undefined,
    accessCodes: input.access_codes,
    validation: input.validation ? JSON.stringify(input.validation) : undefined,
    attributes: input.attributes ? JSON.stringify(input.attributes) : undefined,
    createdAt: now,
    updatedAt: now,
    extensions: input.extensions ? JSON.stringify(input.extensions) : undefined,
  };
  
  const db = await getDbAsync();
  const [created] = await db.insert(addresses).values(dbRecord).returning();
  return deserializeAddress(created);
}

/**
 * Get an address by ID
 */
export async function getAddress(id: string): Promise<Address | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, id))
    .limit(1);
    
  if (!record) return null;
  return deserializeAddress(record);
}

/**
 * List addresses with filtering and pagination
 */
export async function listAddresses(filters: AddressFilters = {}): Promise<Address[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(addresses);
  
  // Build where conditions
  const conditions: any[] = [];
  
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      conditions.push(inArray(addresses.type, filters.type));
    } else {
      conditions.push(eq(addresses.type, filters.type));
    }
  }
  
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(addresses.status, filters.status));
    } else {
      conditions.push(eq(addresses.status, filters.status));
    }
  }
  
  if (filters.country) {
    if (Array.isArray(filters.country)) {
      conditions.push(inArray(addresses.country, filters.country));
    } else {
      conditions.push(eq(addresses.country, filters.country));
    }
  }
  
  if (filters.region) {
    if (Array.isArray(filters.region)) {
      conditions.push(inArray(addresses.region, filters.region));
    } else {
      conditions.push(eq(addresses.region, filters.region));
    }
  }
  
  if (filters.city) {
    conditions.push(like(addresses.city, `%${filters.city}%`));
  }
  
  if (filters.postal_code) {
    conditions.push(eq(addresses.postalCode, filters.postal_code));
  }
  
  if (filters.recipient) {
    conditions.push(like(addresses.recipient, `%${filters.recipient}%`));
  }
  
  if (filters.company) {
    conditions.push(like(addresses.company, `%${filters.company}%`));
  }
  
  if (filters.verified !== undefined) {
    conditions.push(filters.verified 
      ? eq(addresses.status, "verified")
      : or(
          eq(addresses.status, "unverified"),
          eq(addresses.status, "invalid")
        )
    );
  }
  
  if (filters.search) {
    conditions.push(
      or(
        like(addresses.line1, `%${filters.search}%`),
        like(addresses.line2, `%${filters.search}%`),
        like(addresses.city, `%${filters.search}%`),
        like(addresses.region, `%${filters.search}%`),
        like(addresses.postalCode, `%${filters.search}%`),
        like(addresses.recipient, `%${filters.search}%`),
        like(addresses.company, `%${filters.search}%`)
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  // Add sorting
  const sortField = filters.sortBy || 'created_at';
  const sortDir = filters.sortOrder || 'desc';
  
  switch (sortField) {
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.createdAt) : desc(addresses.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.updatedAt) : desc(addresses.updatedAt)) as typeof query;
      break;
    case 'verified_at':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.verifiedAt) : desc(addresses.verifiedAt)) as typeof query;
      break;
    case 'recipient':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.recipient) : desc(addresses.recipient)) as typeof query;
      break;
    case 'company':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.company) : desc(addresses.company)) as typeof query;
      break;
    case 'country':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.country) : desc(addresses.country)) as typeof query;
      break;
    case 'city':
      query = query.orderBy(sortDir === 'asc' ? asc(addresses.city) : desc(addresses.city)) as typeof query;
      break;
    default:
      query = query.orderBy(desc(addresses.createdAt)) as typeof query;
  }
  
  // Add pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }
  
  const records = await query;
  return records.map(deserializeAddress);
}

/**
 * Get address count with filters
 */
export async function getAddressesCount(filters: Omit<AddressFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
  const addresses = await listAddresses(filters);
  return addresses.length;
}

/**
 * Update an existing address
 */
export async function updateAddress(id: string, input: Partial<CreateAddressInput>): Promise<Address | null> {
  const db = await getDbAsync();
  
  // Get existing address first
  const existing = await getAddress(id);
  if (!existing) return null;
  
  // Create updated address object
  const updated: Address = {
    ...existing,
    ...input,
    id, // Ensure ID stays the same
    updated_at: new Date().toISOString(),
  };
  
  const dbRecord = {
    id,
    line1: typeof updated.line1 === 'string' ? updated.line1 : JSON.stringify(updated.line1),
    city: typeof updated.city === 'string' ? updated.city : JSON.stringify(updated.line2),
    country: updated.country,
    type: updated.type ?? "shipping",
    status: updated.status ?? "unverified",
    line2: updated.line2 ? (typeof updated.line2 === 'string' ? updated.line2 : JSON.stringify(updated.line2)) : undefined,
    line3: updated.line3 ? (typeof updated.line3 === 'string' ? updated.line3 : JSON.stringify(updated.line3)) : undefined,
    line4: updated.line4 ? (typeof updated.line4 === 'string' ? updated.line4 : JSON.stringify(updated.line4)) : undefined,
    district: updated.district ? (typeof updated.district === 'string' ? updated.district : JSON.stringify(updated.line4)) : undefined,
    region: updated.region,
    postalCode: updated.postal_code,
    coordinates: updated.coordinates ? JSON.stringify(updated.coordinates) : undefined,
    formatted: updated.formatted ? (typeof updated.formatted === 'string' ? updated.formatted : JSON.stringify(updated.formatted)) : undefined,
    company: updated.company,
    recipient: updated.recipient,
    phone: updated.phone,
    email: updated.email,
    deliveryInstructions: updated.delivery_instructions ? (typeof updated.delivery_instructions === 'string' ? updated.delivery_instructions : JSON.stringify(updated.delivery_instructions)) : undefined,
    accessCodes: updated.access_codes,
    validation: updated.validation ? JSON.stringify(updated.validation) : undefined,
    attributes: updated.attributes ? JSON.stringify(updated.attributes) : undefined,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    extensions: updated.extensions ? JSON.stringify(updated.extensions) : undefined,
  };
  
  await db.update(addresses).set(dbRecord).where(eq(addresses.id, id));
  
  return getAddress(id);
}

/**
 * Delete an address (soft delete by setting status to invalid)
 */
export async function deleteAddress(id: string): Promise<boolean> {
  const result = await updateAddress(id, { status: "invalid" });
  return !!result;
}

/**
 * Hard delete an address (permanent removal)
 */
export async function hardDeleteAddress(id: string): Promise<boolean> {
  const db = await getDbAsync();
  
  await db.delete(addresses).where(eq(addresses.id, id));
  return true;
}

/**
 * Verify an address (mark as verified and update verification timestamp)
 */
export async function verifyAddress(id: string, validationData?: AddressValidation): Promise<Address | null> {
  const db = await getDbAsync();
  
  // Get existing address first
  const existing = await getAddress(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  
  // Create updated address object with verification
  const updated: Address = {
    ...existing,
    status: "verified",
    validation: validationData,
    verified_at: now,
    updated_at: now,
  };
  
  const dbRecord = {
    id: updated.id,
    line1: typeof updated.line1 === 'string' ? updated.line1 : JSON.stringify(updated.line1),
    city: typeof updated.city === 'string' ? updated.city : JSON.stringify(updated.line2),
    country: updated.country,
    type: updated.type ?? "shipping",
    status: updated.status ?? "unverified",
    line2: updated.line2 ? (typeof updated.line2 === 'string' ? updated.line2 : JSON.stringify(updated.line2)) : undefined,
    line3: updated.line3 ? (typeof updated.line3 === 'string' ? updated.line3 : JSON.stringify(updated.line3)) : undefined,
    line4: updated.line4 ? (typeof updated.line4 === 'string' ? updated.line4 : JSON.stringify(updated.line4)) : undefined,
    district: updated.district ? (typeof updated.district === 'string' ? updated.district : JSON.stringify(updated.line4)) : undefined,
    region: updated.region,
    postalCode: updated.postal_code,
    coordinates: updated.coordinates ? JSON.stringify(updated.coordinates) : undefined,
    formatted: updated.formatted ? (typeof updated.formatted === 'string' ? updated.formatted : JSON.stringify(updated.formatted)) : undefined,
    company: updated.company,
    recipient: updated.recipient,
    phone: updated.phone,
    email: updated.email,
    deliveryInstructions: updated.delivery_instructions ? (typeof updated.delivery_instructions === 'string' ? updated.delivery_instructions : JSON.stringify(updated.delivery_instructions)) : undefined,
    accessCodes: updated.access_codes,
    validation: updated.validation ? JSON.stringify(updated.validation) : undefined,
    attributes: updated.attributes ? JSON.stringify(updated.attributes) : undefined,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    extensions: updated.extensions ? JSON.stringify(updated.extensions) : undefined,
  };
  
  await db.update(addresses).set(dbRecord).where(eq(addresses.id, id));
  
  return getAddress(id);
}

/**
 * Get addresses by type
 */
export async function getAddressesByType(type: "shipping" | "billing" | "business" | "residential" | "mailing" | "pickup"): Promise<Address[]> {
  return listAddresses({ type });
}

/**
 * Get addresses by recipient
 */
export async function getAddressesByRecipient(recipient: string): Promise<Address[]> {
  return listAddresses({ recipient });
}

/**
 * Get addresses by country
 */
export async function getAddressesByCountry(country: string): Promise<Address[]> {
  return listAddresses({ country });
}

/**
 * Get verified addresses only
 */
export async function getVerifiedAddresses(): Promise<Address[]> {
  return listAddresses({ verified: true });
}

/**
 * Search addresses by text
 */
export async function searchAddresses(searchTerm: string, limit?: number): Promise<Address[]> {
  return listAddresses({ 
    search: searchTerm, 
    limit: limit || 50 
  });
}

/**
 * Format address for display (create human-readable string)
 */
export function formatAddressForDisplay(address: Address, locale = 'en'): string {
  if (address.formatted) {
    // Use pre-formatted if available
    if (typeof address.formatted === 'string') {
      return address.formatted;
    } else if (address.formatted[locale]) {
      return address.formatted[locale];
    }
  }
  
  // Build formatted address
  const parts: string[] = [];
  
  // Add recipient/company
  if (address.recipient) parts.push(address.recipient);
  if (address.company) parts.push(address.company);
  
  // Add address lines
  const line1 = typeof address.line1 === 'string' ? address.line1 : address.line1[locale] || Object.values(address.line1)[0];
  if (line1) parts.push(line1);
  
  const line2 = typeof address.line2 === 'string' ? address.line2 : address.line2?.[locale];
  if (line2) parts.push(line2);
  
  const line3 = typeof address.line3 === 'string' ? address.line3 : address.line3?.[locale];
  if (line3) parts.push(line3);
  
  const line4 = typeof address.line4 === 'string' ? address.line4 : address.line4?.[locale];
  if (line4) parts.push(line4);
  
  // Add city, region, postal code
  const city = typeof address.city === 'string' ? address.city : address.city[locale] || Object.values(address.city)[0];
  const cityLine = [city, address.region, address.postal_code].filter(Boolean).join(', ');
  if (cityLine) parts.push(cityLine);
  
  // Add country
  if (address.country) parts.push(address.country.toUpperCase());
  
  return parts.join('\n');
}
