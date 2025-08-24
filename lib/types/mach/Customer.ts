/**
 * MACH Alliance Open Data Model - Customer
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/identity/customer.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

import { MACHAddress } from './Address';

/**
 * MACH Alliance Open Data Model - Customer Entity v1.0
 * 
 * A unified customer model that supports both B2B (company/organization) and B2C
 * (individual/person) commerce scenarios across all channels.
 */
export interface MACHCustomer {
  // Core identification - REQUIRED
  id: string;
  type: "person" | "company";

  // Status and lifecycle - OPTIONAL
  status?: "active" | "inactive" | "suspended" | "archived" | "pending_verification";
  external_references?: Record<string, string>;
  created_at?: string; // ISO 8601 timestamp
  updated_at?: string; // ISO 8601 timestamp

  // Person-specific data (B2C) - when type=person
  person?: MACHPersonData;

  // Company-specific data (B2B) - when type=company  
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

  // Extensions for custom data
  extensions?: Record<string, any>;
}

/**
 * Person-specific customer data for B2C scenarios
 */
export interface MACHPersonData {
  // Required
  email: string;

  // Optional personal information
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  phone?: string; // E.164 format recommended
  mobile?: string; // E.164 format
  date_of_birth?: string; // YYYY-MM-DD
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  job_title?: string;
  company_name?: string;
  preferred_language?: string; // BCP 47 (e.g., "en-US", "da-DK")
  nationality?: string; // ISO 3166-1 alpha-2
}

/**
 * Company-specific customer data for B2B scenarios
 */
export interface MACHCompanyData {
  // Required
  name: string;

  // Optional company information
  display_name?: string;
  legal_form?: string; // LLC, Inc, Ltd, GmbH, etc.
  registration_number?: string;
  vat_number?: string;
  duns_number?: string; // D&B D-U-N-S Number (9 digits)
  industry?: string;
  sic_code?: string; // 4 digits
  employee_count?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  annual_revenue?: "<1M" | "1M-10M" | "10M-50M" | "50M-100M" | "100M-500M" | "500M-1B" | ">1B";
  website?: string; // URI format
  parent_company_id?: string;
}

/**
 * Contact person for B2B customer relationships
 */
export interface MACHContactPerson {
  // Required
  id: string;
  email: string;

  // Optional contact details
  first_name?: string;
  last_name?: string;
  phone?: string; // E.164 format
  mobile?: string; // E.164 format
  job_title?: string;
  department?: string;
  role?: "primary" | "billing" | "technical" | "purchasing" | "executive" | "other";
  is_primary?: boolean;
  preferred_language?: string; // BCP 47
  source?: string; // System that manages this contact
}

/**
 * Customer address with type and verification status
 */
export interface MACHCustomerAddress {
  // Required
  type: "billing" | "shipping" | "service" | "registered" | "other";
  address: MACHAddress;

  // Optional address metadata
  id?: string;
  label?: string; // Custom label like "Main Office", "Warehouse #2"
  is_default?: boolean;
  valid_from?: string; // ISO 8601 timestamp
  valid_to?: string; // ISO 8601 timestamp
  verification_status?: "unverified" | "verified" | "invalid" | "needs_update";
}

/**
 * Communication preferences and consent management
 */
export interface MACHCommunicationPreferences {
  email?: MACHChannelPreference;
  sms?: MACHChannelPreference;
  push?: MACHChannelPreference;
  postal?: MACHChannelPreference;
  phone?: MACHChannelPreference;
  
  preferred_channel?: "email" | "sms" | "push" | "postal" | "phone";
  preferred_time?: string; // HH:MM-HH:MM format
  preferred_timezone?: string; // e.g., "Europe/Copenhagen"
  language?: string; // BCP 47
  do_not_disturb?: boolean;
}

/**
 * Channel-specific communication preference
 */
export interface MACHChannelPreference {
  opted_in?: boolean;
  opted_in_date?: string; // ISO 8601 timestamp
  opted_out_date?: string; // ISO 8601 timestamp
  frequency?: "realtime" | "daily" | "weekly" | "monthly" | "never";
  categories?: string[]; // e.g., ["promotional", "transactional", "newsletter"]
  verified?: boolean;
  consent_version?: string;
}

/**
 * Loyalty program information
 */
export interface MACHLoyaltyInfo {
  program_id?: string;
  member_id?: string;
  tier?: string; // e.g., "bronze", "silver", "gold", "platinum"
  points_balance?: number;
  lifetime_points?: number;
  tier_expiry_date?: string; // ISO 8601 timestamp
  member_since?: string; // ISO 8601 timestamp
  next_tier_points?: number;
  benefits?: string[]; // e.g., ["free_shipping", "early_access", "birthday_discount"]
}

/**
 * Authentication and security settings
 */
export interface MACHAuthenticationSettings {
  username?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  two_factor_enabled?: boolean;
  two_factor_methods?: ("sms" | "authenticator" | "email" | "backup_codes")[];
  password_last_changed?: string; // ISO 8601 timestamp
  force_password_change?: boolean;
  last_login?: string; // ISO 8601 timestamp
  failed_login_attempts?: number;
  account_locked?: boolean;
  locked_until?: string; // ISO 8601 timestamp
}

// Type guards for customer type discrimination
export function isPersonCustomer(customer: MACHCustomer): customer is MACHCustomer & { type: "person"; person: MACHPersonData } {
  return customer.type === "person" && !!customer.person;
}

export function isCompanyCustomer(customer: MACHCustomer): customer is MACHCustomer & { type: "company"; company: MACHCompanyData } {
  return customer.type === "company" && !!customer.company;
}

// Sample objects for reference

/**
 * Sample B2C Customer
 */
export const sampleB2CCustomer: MACHCustomer = {
  id: "CUST-B2C-001",
  type: "person",
  status: "active",
  external_references: {
    crm_contact_id: "CRM-123456",
    commerce_engine: "CE-98765",
    loyalty_system: "LOY-123456"
  },
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-07-20T14:30:00Z",
  person: {
    first_name: "Emma",
    last_name: "Larsen",
    email: "emma.larsen@example.com",
    phone: "+4512345678",
    mobile: "+4587654321",
    date_of_birth: "1985-03-15",
    gender: "female",
    preferred_language: "da-DK"
  },
  addresses: [{
    id: "ADDR-001",
    type: "billing",
    is_default: true,
    address: {
      line1: "Strandvejen 100",
      line2: "2. sal",
      city: "Aarhus",
      region: "Midtjylland",
      postal_code: "8000",
      country: "DK"
    },
    verification_status: "verified"
  }],
  segments: ["frequent_buyer", "danish_market", "premium_customer"],
  tags: ["early_adopter", "sustainability_focused"]
};

/**
 * Sample B2B Customer
 */
export const sampleB2BCustomer: MACHCustomer = {
  id: "CUST-B2B-001",
  type: "company",
  status: "active",
  external_references: {
    crm_account_id: "CRM-ACCT-9012",
    erp_customer_id: "ERP-443322",
    commerce_engine: "CE-COMPANY-654321"
  },
  created_at: "2023-05-10T08:00:00Z",
  updated_at: "2024-07-15T16:45:00Z",
  company: {
    name: "Nordic Tech Solutions A/S",
    display_name: "Nordic Tech",
    legal_form: "A/S",
    registration_number: "DK12345678",
    vat_number: "DK98765432",
    industry: "Technology",
    sic_code: "7372",
    employee_count: "51-200",
    annual_revenue: "10M-50M",
    website: "https://www.nordictech.dk"
  },
  contacts: [{
    id: "CONTACT-001",
    first_name: "Lars",
    last_name: "Jensen",
    email: "lars.jensen@nordictech.dk",
    phone: "+4533445566",
    job_title: "Purchasing Manager",
    role: "purchasing",
    is_primary: true,
    preferred_language: "da-DK",
    source: "CRM"
  }],
  addresses: [{
    id: "ADDR-B2B-001",
    type: "billing",
    label: "Headquarters",
    is_default: true,
    address: {
      line1: "Østergade 15",
      city: "Copenhagen",
      region: "Hovedstaden",
      postal_code: "1100",
      country: "DK"
    },
    verification_status: "verified"
  }],
  extensions: {
    b2b: {
      payment_terms: "net30",
      credit_limit: {
        amount: 250000.00,
        currency: "DKK"
      },
      tax_exempt: false,
      purchase_order_required: true,
      account_manager: "AM-005",
      source: "ERP"
    }
  }
};
