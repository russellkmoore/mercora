/**
 * MACH Alliance Open Data Model - Customer Model
 * 
 * Business logic and CRUD operations for customer management
 * following the MACH Alliance Customer specification.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/identity/customer.md
 */

import { getDbAsync } from "../../db";
import { customers, transformToMACHCustomer, transformFromMACHCustomer } from "../../db/schema/customer";
import { eq, desc, asc, like, or, and, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import type { 
  MACHCustomer, 
  MACHPersonData, 
  MACHCompanyData, 
  MACHContactPerson, 
  MACHCustomerAddress,
  MACHCommunicationPreferences,
  MACHLoyaltyInfo,
  MACHAuthenticationSettings
} from "../../types/mach/Customer";
import type { MACHAddress } from "../../types/mach/Address";

// Re-export types for easier access
export type { 
  MACHCustomer,
  MACHPersonData,
  MACHCompanyData,
  MACHContactPerson,
  MACHCustomerAddress,
  MACHCommunicationPreferences,
  MACHLoyaltyInfo,
  MACHAuthenticationSettings
} from "../../types/mach/Customer";

// Customer creation input type
export interface CreateCustomerInput {
  // Required fields
  id?: string; // Will be auto-generated if not provided
  type: "person" | "company";
  
  // Optional status and lifecycle
  status?: "active" | "inactive" | "suspended" | "archived" | "pending_verification";
  external_references?: Record<string, string>; // Cross-system IDs
  
  // Person-specific data (B2C)
  person?: MACHPersonData;
  
  // Company-specific data (B2B)
  company?: MACHCompanyData;
  
  // Contact persons (primarily for B2B)
  contacts?: MACHContactPerson[];
  
  // Addresses
  addresses?: MACHCustomerAddress[];
  
  // Communication preferences
  communication_preferences?: MACHCommunicationPreferences;
  
  // Segmentation
  segments?: string[];
  tags?: string[];
  
  // Loyalty information
  loyalty?: MACHLoyaltyInfo;
  
  // Authentication settings
  authentication?: MACHAuthenticationSettings;
  
  // Extensions
  extensions?: Record<string, any>;
}

// Customer update input type
export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  id: string;
}

// Customer filter options
export interface CustomerFilters {
  type?: "person" | "company" | ("person" | "company")[];
  status?: "active" | "inactive" | "suspended" | "archived" | "pending_verification" | ("active" | "inactive" | "suspended" | "archived" | "pending_verification")[];
  email?: string; // Search by email (person customers)
  company_name?: string; // Search by company name (company customers)
  segments?: string | string[]; // Filter by segments
  tags?: string | string[]; // Filter by tags
  loyalty_tier?: string | string[]; // Filter by loyalty tier
  created_after?: string; // Created after date
  created_before?: string; // Created before date
  updated_after?: string; // Updated after date
  updated_before?: string; // Updated before date
  has_addresses?: boolean; // Has addresses
  has_loyalty?: boolean; // Has loyalty program membership
  email_verified?: boolean; // Email verification status
  phone_verified?: boolean; // Phone verification status
  two_factor_enabled?: boolean; // 2FA enabled status
  search?: string; // General text search
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'last_login' | 'company_name' | 'email';
  sortOrder?: 'asc' | 'desc';
}

// Customer validation result
export interface CustomerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Generate a unique customer ID
 */
function generateCustomerId(type: "person" | "company"): string {
  const prefix = type === "person" ? "cust_p" : "cust_c";
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate customer data according to MACH Alliance standards
 */
export function validateCustomer(customer: Partial<MACHCustomer>): CustomerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!customer.id) {
    errors.push("id is required");
  }
  
  if (!customer.type) {
    errors.push("type is required");
  } else if (!["person", "company"].includes(customer.type)) {
    errors.push("type must be 'person' or 'company'");
  }
  
  // Type-specific validation
  if (customer.type === "person") {
    if (!customer.person) {
      errors.push("person data is required for person-type customers");
    } else {
      // Person-specific validation
      if (!customer.person.email) {
        errors.push("email is required for person customers");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.person.email)) {
        errors.push("email must be a valid email address");
      }
      
      // Phone format validation (E.164)
      if (customer.person.phone && !/^\+?[1-9]\d{1,14}$/.test(customer.person.phone)) {
        warnings.push("phone should use E.164 format (+[country][number])");
      }
      if (customer.person.mobile && !/^\+?[1-9]\d{1,14}$/.test(customer.person.mobile)) {
        warnings.push("mobile should use E.164 format (+[country][number])");
      }
      
      // Language format validation (BCP 47)
      if (customer.person.preferred_language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(customer.person.preferred_language)) {
        warnings.push("preferred_language should use BCP 47 format (e.g., en-US, da-DK)");
      }
      
      // Nationality format validation (ISO 3166-1 alpha-2)
      if (customer.person.nationality && !/^[A-Z]{2}$/.test(customer.person.nationality)) {
        warnings.push("nationality should use ISO 3166-1 alpha-2 format (e.g., US, DK)");
      }
    }
    
    // Warn if company data exists for person
    if (customer.company) {
      warnings.push("company data should not be present for person-type customers");
    }
  }
  
  if (customer.type === "company") {
    if (!customer.company) {
      errors.push("company data is required for company-type customers");
    } else {
      // Company-specific validation
      if (!customer.company.name) {
        errors.push("company name is required for company customers");
      }
      
      // DUNS number format validation
      if (customer.company.duns_number && !/^\d{9}$/.test(customer.company.duns_number)) {
        errors.push("duns_number must be exactly 9 digits");
      }
      
      // SIC code format validation
      if (customer.company.sic_code && !/^\d{4}$/.test(customer.company.sic_code)) {
        errors.push("sic_code must be exactly 4 digits");
      }
      
      // Website format validation
      if (customer.company.website) {
        try {
          new URL(customer.company.website);
        } catch {
          errors.push("website must be a valid URL");
        }
      }
    }
    
    // Warn if person data exists for company
    if (customer.person) {
      warnings.push("person data should not be present for company-type customers");
    }
  }
  
  // Contact persons validation
  if (customer.contacts) {
    customer.contacts.forEach((contact, index) => {
      if (!contact.id) {
        errors.push(`contacts[${index}].id is required`);
      }
      if (!contact.email) {
        errors.push(`contacts[${index}].email is required`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        errors.push(`contacts[${index}].email must be a valid email address`);
      }
      
      // Phone format validation for contacts
      if (contact.phone && !/^\+?[1-9]\d{1,14}$/.test(contact.phone)) {
        warnings.push(`contacts[${index}].phone should use E.164 format`);
      }
      if (contact.mobile && !/^\+?[1-9]\d{1,14}$/.test(contact.mobile)) {
        warnings.push(`contacts[${index}].mobile should use E.164 format`);
      }
    });
    
    // Check for multiple primary contacts
    const primaryContacts = customer.contacts.filter(c => c.is_primary);
    if (primaryContacts.length > 1) {
      warnings.push("only one contact should be marked as primary");
    }
  }
  
  // Address validation
  if (customer.addresses) {
    customer.addresses.forEach((addr, index) => {
      if (!addr.type) {
        errors.push(`addresses[${index}].type is required`);
      }
      if (!addr.address) {
        errors.push(`addresses[${index}].address is required`);
      } else {
        // Basic address validation
        if (!addr.address.line1) {
          errors.push(`addresses[${index}].address.line1 is required`);
        }
        if (!addr.address.city) {
          errors.push(`addresses[${index}].address.city is required`);
        }
        if (!addr.address.country) {
          errors.push(`addresses[${index}].address.country is required`);
        } else if (addr.address.country.length !== 2) {
          errors.push(`addresses[${index}].address.country must be ISO 3166-1 alpha-2 format`);
        }
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a new customer
 */
export async function createCustomer(input: CreateCustomerInput): Promise<MACHCustomer> {
  const id = input.id || generateCustomerId(input.type);
  const now = new Date().toISOString();
  
  const machCustomer: MACHCustomer = {
    id,
    type: input.type,
    status: input.status ?? "active",
    external_references: input.external_references,
    created_at: now,
    updated_at: now,
    person: input.person,
    company: input.company,
    contacts: input.contacts,
    addresses: input.addresses,
    communication_preferences: input.communication_preferences,
    segments: input.segments,
    tags: input.tags,
    loyalty: input.loyalty,
    authentication: input.authentication,
    extensions: input.extensions,
  };
  
  // Validate before creating
  const validation = validateCustomer(machCustomer);
  if (!validation.isValid) {
    throw new Error(`Customer validation failed: ${validation.errors.join(', ')}`);
  }
  
  const db = await getDbAsync();
  const record = transformFromMACHCustomer(machCustomer);
  const [created] = await db.insert(customers).values(record).returning();
  return transformToMACHCustomer(created);
}

/**
 * Get a customer by ID
 */
export async function getCustomer(id: string): Promise<MACHCustomer | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
    
  if (!record) return null;
  return transformToMACHCustomer(record);
}

/**
 * Get a customer by email (person customers only)
 */
export async function getCustomerByEmail(email: string): Promise<MACHCustomer | null> {
  const db = await getDbAsync();
  
  // Note: This is a simplified approach. In production, you might want to use
  // a separate email index table or database-specific JSON querying
  const records = await db
    .select()
    .from(customers)
    .where(eq(customers.type, "person"));
  
  for (const record of records) {
    const customer = transformToMACHCustomer(record);
    if (customer.person?.email?.toLowerCase() === email.toLowerCase()) {
      return customer;
    }
  }
  
  return null;
}

/**
 * Get a customer by company name (company customers only)
 */
export async function getCustomerByCompanyName(companyName: string): Promise<MACHCustomer | null> {
  const db = await getDbAsync();
  
  const records = await db
    .select()
    .from(customers)
    .where(eq(customers.type, "company"));
  
  for (const record of records) {
    const customer = transformToMACHCustomer(record);
    if (customer.company?.name?.toLowerCase() === companyName.toLowerCase()) {
      return customer;
    }
  }
  
  return null;
}

/**
 * List customers with filtering and pagination
 */
export async function listCustomers(filters: CustomerFilters = {}): Promise<MACHCustomer[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(customers);
  
  // Build where conditions
  const conditions: any[] = [];
  
  // Type filter
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      conditions.push(inArray(customers.type, filters.type));
    } else {
      conditions.push(eq(customers.type, filters.type));
    }
  }
  
  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(customers.status, filters.status));
    } else {
      conditions.push(eq(customers.status, filters.status));
    }
  }
  
  // Date range filters
  if (filters.created_after) {
    conditions.push(sql`${customers.createdAt} >= ${filters.created_after}`);
  }
  if (filters.created_before) {
    conditions.push(sql`${customers.createdAt} <= ${filters.created_before}`);
  }
  if (filters.updated_after) {
    conditions.push(sql`${customers.updatedAt} >= ${filters.updated_after}`);
  }
  if (filters.updated_before) {
    conditions.push(sql`${customers.updatedAt} <= ${filters.updated_before}`);
  }
  
  // Optional feature filters
  if (filters.has_addresses !== undefined) {
    if (filters.has_addresses) {
      conditions.push(isNotNull(customers.addresses));
    } else {
      conditions.push(isNull(customers.addresses));
    }
  }
  
  if (filters.has_loyalty !== undefined) {
    if (filters.has_loyalty) {
      conditions.push(isNotNull(customers.loyalty));
    } else {
      conditions.push(isNull(customers.loyalty));
    }
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  // Add sorting
  const sortField = filters.sortBy || 'created_at';
  const sortDir = filters.sortOrder || 'desc';
  
  switch (sortField) {
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(customers.createdAt) : desc(customers.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(customers.updatedAt) : desc(customers.updatedAt)) as typeof query;
      break;
    default:
      query = query.orderBy(desc(customers.createdAt)) as typeof query;
  }
  
  // Add pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }
  
  const records = await query;
  let filteredCustomers = records.map(record => transformToMACHCustomer(record));
  
  // Apply additional filters that require JSON parsing
  if (filters.email) {
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.person?.email?.toLowerCase().includes(filters.email!.toLowerCase())
    );
  }
  
  if (filters.company_name) {
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.company?.name?.toLowerCase().includes(filters.company_name!.toLowerCase())
    );
  }
  
  if (filters.segments) {
    const targetSegments = Array.isArray(filters.segments) ? filters.segments : [filters.segments];
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.segments?.some(segment => targetSegments.includes(segment))
    );
  }
  
  if (filters.tags) {
    const targetTags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.tags?.some(tag => targetTags.includes(tag))
    );
  }
  
  if (filters.loyalty_tier) {
    const targetTiers = Array.isArray(filters.loyalty_tier) ? filters.loyalty_tier : [filters.loyalty_tier];
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.loyalty?.tier && targetTiers.includes(customer.loyalty.tier)
    );
  }
  
  if (filters.email_verified !== undefined) {
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.authentication?.email_verified === filters.email_verified
    );
  }
  
  if (filters.phone_verified !== undefined) {
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.authentication?.phone_verified === filters.phone_verified
    );
  }
  
  if (filters.two_factor_enabled !== undefined) {
    filteredCustomers = filteredCustomers.filter(customer => 
      customer.authentication?.two_factor_enabled === filters.two_factor_enabled
    );
  }
  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredCustomers = filteredCustomers.filter(customer => {
      // Search in person data
      if (customer.person) {
        const personMatch = 
          customer.person.first_name?.toLowerCase().includes(searchTerm) ||
          customer.person.last_name?.toLowerCase().includes(searchTerm) ||
          customer.person.full_name?.toLowerCase().includes(searchTerm) ||
          customer.person.email?.toLowerCase().includes(searchTerm) ||
          customer.person.phone?.includes(searchTerm) ||
          customer.person.mobile?.includes(searchTerm);
        if (personMatch) return true;
      }
      
      // Search in company data
      if (customer.company) {
        const companyMatch =
          customer.company.name?.toLowerCase().includes(searchTerm) ||
          customer.company.display_name?.toLowerCase().includes(searchTerm) ||
          customer.company.website?.toLowerCase().includes(searchTerm) ||
          customer.company.registration_number?.includes(searchTerm) ||
          customer.company.vat_number?.includes(searchTerm);
        if (companyMatch) return true;
      }
      
      // Search in segments and tags
      const segmentMatch = customer.segments?.some(segment => 
        segment.toLowerCase().includes(searchTerm)
      );
      const tagMatch = customer.tags?.some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      
      return segmentMatch || tagMatch;
    });
  }
  
  return filteredCustomers;
}

/**
 * Get customers count with filters
 */
export async function getCustomersCount(filters: Omit<CustomerFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
  const customers = await listCustomers(filters);
  return customers.length;
}

/**
 * Update an existing customer
 */
export async function updateCustomer(id: string, input: Partial<CreateCustomerInput>): Promise<MACHCustomer | null> {
  const db = await getDbAsync();
  
  // Get existing customer first
  const existing = await getCustomer(id);
  if (!existing) return null;
  
  // Create updated customer object
  const updated: MACHCustomer = {
    ...existing,
    ...input,
    id, // Ensure ID stays the same
    updated_at: new Date().toISOString(),
  };
  
  // Validate before updating
  const validation = validateCustomer(updated);
  if (!validation.isValid) {
    throw new Error(`Customer validation failed: ${validation.errors.join(', ')}`);
  }
  
  const record = transformFromMACHCustomer(updated);
  await db.update(customers).set(record).where(eq(customers.id, id));
  
  return getCustomer(id);
}

/**
 * Delete a customer (soft delete by setting status to archived)
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  const result = await updateCustomer(id, { status: "archived" });
  return !!result;
}

/**
 * Hard delete a customer (permanent removal)
 */
export async function hardDeleteCustomer(id: string): Promise<boolean> {
  const db = await getDbAsync();
  
  await db.delete(customers).where(eq(customers.id, id));
  return true;
}

/**
 * Get customers by type
 */
export async function getCustomersByType(type: "person" | "company"): Promise<MACHCustomer[]> {
  return listCustomers({ type });
}

/**
 * Get active customers
 */
export async function getActiveCustomers(): Promise<MACHCustomer[]> {
  return listCustomers({ status: "active" });
}

/**
 * Get customers by segment
 */
export async function getCustomersBySegment(segment: string): Promise<MACHCustomer[]> {
  return listCustomers({ segments: segment });
}

/**
 * Get customers by tag
 */
export async function getCustomersByTag(tag: string): Promise<MACHCustomer[]> {
  return listCustomers({ tags: tag });
}

/**
 * Get customers by loyalty tier
 */
export async function getCustomersByLoyaltyTier(tier: string): Promise<MACHCustomer[]> {
  return listCustomers({ loyalty_tier: tier });
}

/**
 * Search customers by text
 */
export async function searchCustomers(searchTerm: string, limit?: number): Promise<MACHCustomer[]> {
  return listCustomers({ 
    search: searchTerm, 
    limit: limit || 50 
  });
}

/**
 * Add address to customer
 */
export async function addCustomerAddress(customerId: string, address: MACHCustomerAddress): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer) return null;
  
  const addresses = customer.addresses || [];
  addresses.push(address);
  
  return updateCustomer(customerId, { addresses });
}

/**
 * Update customer address
 */
export async function updateCustomerAddress(customerId: string, addressId: string, address: Partial<MACHCustomerAddress>): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.addresses) return null;
  
  const addresses = customer.addresses.map(addr => 
    addr.id === addressId ? { ...addr, ...address } : addr
  );
  
  return updateCustomer(customerId, { addresses });
}

/**
 * Remove address from customer
 */
export async function removeCustomerAddress(customerId: string, addressId: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.addresses) return null;
  
  const addresses = customer.addresses.filter(addr => addr.id !== addressId);
  
  return updateCustomer(customerId, { addresses });
}

/**
 * Add contact person to customer (B2B)
 */
export async function addCustomerContact(customerId: string, contact: MACHContactPerson): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || customer.type !== "company") return null;
  
  const contacts = customer.contacts || [];
  contacts.push(contact);
  
  return updateCustomer(customerId, { contacts });
}

/**
 * Update customer contact
 */
export async function updateCustomerContact(customerId: string, contactId: string, contact: Partial<MACHContactPerson>): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.contacts) return null;
  
  const contacts = customer.contacts.map(c => 
    c.id === contactId ? { ...c, ...contact } : c
  );
  
  return updateCustomer(customerId, { contacts });
}

/**
 * Remove contact from customer
 */
export async function removeCustomerContact(customerId: string, contactId: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.contacts) return null;
  
  const contacts = customer.contacts.filter(c => c.id !== contactId);
  
  return updateCustomer(customerId, { contacts });
}

/**
 * Update customer communication preferences
 */
export async function updateCommunicationPreferences(customerId: string, preferences: MACHCommunicationPreferences): Promise<MACHCustomer | null> {
  return updateCustomer(customerId, { communication_preferences: preferences });
}

/**
 * Update customer loyalty information
 */
export async function updateCustomerLoyalty(customerId: string, loyalty: MACHLoyaltyInfo): Promise<MACHCustomer | null> {
  return updateCustomer(customerId, { loyalty });
}

/**
 * Update customer authentication settings
 */
export async function updateCustomerAuthentication(customerId: string, authentication: MACHAuthenticationSettings): Promise<MACHCustomer | null> {
  return updateCustomer(customerId, { authentication });
}

/**
 * Add segment to customer
 */
export async function addCustomerSegment(customerId: string, segment: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer) return null;
  
  const segments = customer.segments || [];
  if (!segments.includes(segment)) {
    segments.push(segment);
    return updateCustomer(customerId, { segments });
  }
  
  return customer;
}

/**
 * Remove segment from customer
 */
export async function removeCustomerSegment(customerId: string, segment: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.segments) return null;
  
  const segments = customer.segments.filter(s => s !== segment);
  
  return updateCustomer(customerId, { segments });
}

/**
 * Add tag to customer
 */
export async function addCustomerTag(customerId: string, tag: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer) return null;
  
  const tags = customer.tags || [];
  if (!tags.includes(tag)) {
    tags.push(tag);
    return updateCustomer(customerId, { tags });
  }
  
  return customer;
}

/**
 * Remove tag from customer
 */
export async function removeCustomerTag(customerId: string, tag: string): Promise<MACHCustomer | null> {
  const customer = await getCustomer(customerId);
  if (!customer || !customer.tags) return null;
  
  const tags = customer.tags.filter(t => t !== tag);
  
  return updateCustomer(customerId, { tags });
}

/**
 * Get customer display name
 */
export function getCustomerDisplayName(customer: MACHCustomer): string {
  if (customer.type === "person" && customer.person) {
    const { first_name, last_name, full_name } = customer.person;
    return full_name || `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown Person';
  }
  
  if (customer.type === "company" && customer.company) {
    return customer.company.display_name || customer.company.name || 'Unknown Company';
  }
  
  return `Customer ${customer.id}`;
}

/**
 * Get customer primary email
 */
export function getCustomerPrimaryEmail(customer: MACHCustomer): string | null {
  if (customer.type === "person" && customer.person?.email) {
    return customer.person.email;
  }
  
  if (customer.type === "company" && customer.contacts) {
    const primaryContact = customer.contacts.find(c => c.is_primary);
    if (primaryContact) return primaryContact.email;
    
    // Fallback to first contact if no primary
    if (customer.contacts.length > 0) return customer.contacts[0].email;
  }
  
  return null;
}

/**
 * Get customer primary phone
 */
export function getCustomerPrimaryPhone(customer: MACHCustomer): string | null {
  if (customer.type === "person" && customer.person) {
    return customer.person.phone || customer.person.mobile || null;
  }
  
  if (customer.type === "company" && customer.contacts) {
    const primaryContact = customer.contacts.find(c => c.is_primary);
    if (primaryContact) return primaryContact.phone || primaryContact.mobile || null;
    
    // Fallback to first contact if no primary
    if (customer.contacts.length > 0) {
      const contact = customer.contacts[0];
      return contact.phone || contact.mobile || null;
    }
  }
  
  return null;
}
