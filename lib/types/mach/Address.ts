/**
 * MACH Alliance Open Data Model - Address
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/utilities/address.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

/**
 * MACH Alliance Open Data Model - Address Utility Object v1.0
 * 
 * A standardized utility object for representing physical and mailing addresses
 * across all entities in the MACH Alliance Common Data Model.
 */
export type MACHAddress = {
  // Core address components - REQUIRED
  line1: string | Record<string, string>; // Localizable
  city: string | Record<string, string>; // Localizable
  country: string; // ISO 3166-1 alpha-2

  // Classification - OPTIONAL
  id?: string;
  type?: "shipping" | "billing" | "business" | "residential" | "mailing" | "pickup";
  status?: "active" | "invalid" | "undeliverable" | "verified" | "unverified";

  // Additional address lines - OPTIONAL
  line2?: string | Record<string, string>; // Localizable
  line3?: string | Record<string, string>; // Localizable
  line4?: string | Record<string, string>; // Localizable

  // Location components - OPTIONAL
  district?: string | Record<string, string>; // Localizable
  region?: string; // State, province, or administrative region
  postal_code?: string;

  // Geographic data - OPTIONAL
  coordinates?: MACHCoordinates;
  formatted?: string | Record<string, string>; // Localizable

  // Contact information - OPTIONAL
  company?: string;
  recipient?: string;
  phone?: string; // E.164 format recommended
  email?: string;

  // Delivery details - OPTIONAL
  delivery_instructions?: string | Record<string, string>; // Localizable
  access_codes?: string;

  // Validation metadata - OPTIONAL
  validation?: MACHAddressValidation;

  // Additional attributes - OPTIONAL
  attributes?: Record<string, any>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
  verified_at?: string; // ISO 8601

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Geographic coordinates for mapping and routing
 */
export type MACHCoordinates = {
  latitude: number; // -90 to 90
  longitude: number; // -180 to 180
  altitude?: number; // meters
  accuracy?: number; // accuracy radius in meters
}

/**
 * Address validation metadata
 */
export type MACHAddressValidation = {
  provider?: string; // e.g., "google-maps", "ups-address-validation", "usps"
  validation_id?: string;
  confidence_score?: number; // 0-100
  standardized?: boolean;
  deliverable?: boolean;
  residential?: boolean;
  corrections?: MACHAddressCorrection[];
  validation_errors?: string[];
  validated_at?: string; // ISO 8601
}

/**
 * Suggested address corrections
 */
export type MACHAddressCorrection = {
  field: string; // e.g., "postal_code"
  original: string;
  suggested: string;
  confidence: number; // 0-100
}

// Type guards for address type discrimination
export function isBillingAddress(address: MACHAddress): boolean {
  return address.type === "billing";
}

export function isShippingAddress(address: MACHAddress): boolean {
  return address.type === "shipping";
}

export function isVerifiedAddress(address: MACHAddress): boolean {
  return address.status === "verified";
}

// Sample objects for reference

/**
 * Sample minimal address
 */
export const sampleMinimalAddress: MACHAddress = {
  line1: "123 Main Street",
  city: "New York",
  country: "US"
};

/**
 * Sample US business address
 */
export const sampleUSBusinessAddress: MACHAddress = {
  id: "ADDR-BUS-001",
  type: "business",
  status: "verified",
  company: "MACH Technologies Inc.",
  recipient: "Shipping Department",
  line1: "1234 Business Park Drive",
  line2: "Building 5, Suite 300",
  city: "San Francisco",
  region: "CA",
  postal_code: "94105",
  country: "US",
  phone: "+14155551234",
  email: "shipping@mach-tech.com",
  coordinates: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10
  },
  delivery_instructions: "Use loading dock on west side",
  access_codes: "Dock: 4567",
  validation: {
    provider: "usps",
    validation_id: "VAL-123456",
    confidence_score: 98.5,
    standardized: true,
    deliverable: true,
    residential: false,
    validated_at: "2024-01-15T10:30:00Z"
  },
  attributes: {
    building_type: "commercial",
    loading_dock: true,
    delivery_hours: "8am-5pm PST",
    floor: "3",
    requires_appointment: false
  }
};

/**
 * Sample localized address (European)
 */
export const sampleLocalizedAddress: MACHAddress = {
  id: "ADDR-RES-002",
  type: "residential",
  status: "verified",
  recipient: "Marie Dubois",
  line1: "15 Rue de la Paix",
  line2: "Appartement 4B",
  line3: "Bâtiment Les Lilas",
  city: "Paris",
  district: "8ème arrondissement",
  region: "Île-de-France",
  postal_code: "75008",
  country: "FR",
  phone: "+33123456789",
  email: "marie.dubois@example.com",
  coordinates: {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 5
  },
  delivery_instructions: {
    "fr-FR": "Sonner à l'interphone 'Dubois'",
    "en-US": "Ring intercom 'Dubois'"
  },
  access_codes: "1234A",
  validation: {
    provider: "la-poste",
    confidence_score: 95,
    standardized: true,
    deliverable: true,
    residential: true
  },
  attributes: {
    building_type: "apartment",
    floor: "4",
    elevator: true,
    intercom: true
  }
};
