/**
 * MACH Alliance Open Data Model - Product Type
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/product/product-type.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

/**
 * MACH Alliance Open Data Model - Product Type Entity v1.0
 * 
 * A unified product type model that defines the classification, structure, and
 * shared attributes for products across all commerce channels. Serves as a template
 * that enforces consistency, enables attribute inheritance, and supports complex
 * product hierarchies for both B2B and B2C scenarios.
 */
export interface MACHProductType {
  // Core identification - REQUIRED
  id: string; // Unique identifier for the product type
  name: string | Record<string, string>; // Product type name (localizable)
  attribute_definitions: Record<string, MACHAttributeDefinition>; // Schema defining attributes

  // Status and lifecycle - OPTIONAL
  status?: "active" | "inactive" | "deprecated";
  external_references?: Record<string, string>; // Cross-system IDs (UNSPSC, eCl@ss)
  
  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601 creation timestamp
  updated_at?: string; // ISO 8601 update timestamp

  // Display information - OPTIONAL (localizable)
  description?: string | Record<string, string>;

  // Hierarchy and inheritance - OPTIONAL
  parent_type_id?: string; // Reference to parent type for inheritance
  
  // Schema and validation - OPTIONAL
  required_attributes?: string[]; // List of attribute IDs that must be populated
  version?: string; // Schema version for migration support (semantic versioning)

  // Classification and organization - OPTIONAL
  category_path?: string[]; // Hierarchical category classification
  tags?: string[]; // Tags for filtering and organization

  // Applicability - OPTIONAL
  applicable_channels?: string[]; // Channels where this product type is valid
  applicable_regions?: string[]; // Regions where this product type is valid (ISO codes)

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Attribute definition schema for product attributes
 */
export interface MACHAttributeDefinition {
  // Core definition - REQUIRED
  type: "text" | "number" | "boolean" | "date" | "datetime" | "select" | "multiselect" | "money" | "dimension" | "weight" | "url" | "email" | "json" | "rich_text";
  label: string | Record<string, string>; // Display label (localizable)

  // Additional information - OPTIONAL
  description?: string | Record<string, string>; // Help text (localizable)
  
  // Behavior flags - OPTIONAL
  is_required?: boolean; // Whether this attribute is mandatory
  is_unique?: boolean; // Whether values must be unique across products
  is_searchable?: boolean; // Whether this attribute is searchable
  is_variant_defining?: boolean; // Whether this attribute creates product variants

  // Validation and constraints - OPTIONAL
  validation?: MACHAttributeValidation;
  options?: MACHAttributeOption[]; // Available options for select/multiselect types
  default_value?: any; // Default value for the attribute

  // Metadata - OPTIONAL
  unit?: string; // Unit of measurement for numeric attributes
  source?: string; // System that manages this attribute
  position?: number; // Display order for the attribute
}

/**
 * Validation rules for attributes
 */
export interface MACHAttributeValidation {
  pattern?: string; // Regex pattern for text validation
  min?: number; // Minimum value for numeric attributes
  max?: number; // Maximum value for numeric attributes
  min_length?: number; // Minimum length for text attributes
  max_length?: number; // Maximum length for text attributes
  allowed_values?: any[]; // Explicit list of allowed values
  custom_validator?: string; // Reference to custom validation function
}

/**
 * Option definition for select/multiselect attributes
 */
export interface MACHAttributeOption {
  // Core option data - REQUIRED
  value: string; // Internal value stored in the system
  label: string | Record<string, string>; // Display label (localizable)

  // Display and behavior - OPTIONAL
  position?: number; // Display order for the option
  is_default?: boolean; // Whether this is the default option
  metadata?: Record<string, any>; // Additional metadata for the option
}

// Type guards for product type discrimination

export function isActiveProductType(productType: MACHProductType): boolean {
  return productType.status === "active" || productType.status === undefined;
}

export function isDeprecatedProductType(productType: MACHProductType): boolean {
  return productType.status === "deprecated";
}

export function hasParentType(productType: MACHProductType): boolean {
  return productType.parent_type_id !== undefined;
}

export function hasRequiredAttributes(productType: MACHProductType): boolean {
  return productType.required_attributes !== undefined && productType.required_attributes.length > 0;
}

export function hasExternalReferences(productType: MACHProductType): boolean {
  return productType.external_references !== undefined;
}

export function isSelectAttribute(attr: MACHAttributeDefinition): boolean {
  return attr.type === "select" || attr.type === "multiselect";
}

export function isVariantDefiningAttribute(attr: MACHAttributeDefinition): boolean {
  return attr.is_variant_defining === true;
}

export function isRequiredAttribute(attr: MACHAttributeDefinition): boolean {
  return attr.is_required === true;
}

// Sample objects for reference

/**
 * Sample minimal product type
 */
export const sampleMinimalProductType: MACHProductType = {
  id: "PT-BASIC",
  name: "Basic Product",
  attribute_definitions: {
    name: {
      type: "text",
      label: "Product Name",
      is_required: true
    }
  }
};

/**
 * Sample basic apparel product type
 */
export const sampleApparelProductType: MACHProductType = {
  id: "PT-APPAREL-001",
  name: "Apparel",
  description: "Clothing and fashion items",
  status: "active",
  external_references: {
    unspsc: "53100000",
    internal_code: "APP-001"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-06-15T10:30:00Z",
  attribute_definitions: {
    material: {
      type: "text",
      label: "Material Composition",
      is_required: true,
      is_searchable: true,
      source: "pim_system"
    },
    size: {
      type: "select",
      label: "Size",
      is_required: true,
      is_variant_defining: true,
      options: [
        { value: "xs", label: "Extra Small" },
        { value: "s", label: "Small" },
        { value: "m", label: "Medium" },
        { value: "l", label: "Large" },
        { value: "xl", label: "Extra Large" }
      ],
      source: "pim_system"
    },
    color: {
      type: "select",
      label: "Color",
      is_required: true,
      is_variant_defining: true,
      is_searchable: true,
      source: "pim_system"
    },
    care_instructions: {
      type: "text",
      label: "Care Instructions",
      is_required: false,
      source: "pim_system"
    }
  },
  required_attributes: ["material", "size", "color"],
  category_path: ["clothing", "apparel"],
  version: "1.0.0",
  tags: ["fashion", "b2c"],
  applicable_channels: ["web", "mobile", "store"]
};

/**
 * Sample multi-language electronics product type
 */
export const sampleElectronicsProductType: MACHProductType = {
  id: "PT-ELECTRONICS-001",
  name: {
    "en-US": "Consumer Electronics",
    "es-ES": "Electrónica de Consumo",
    "fr-FR": "Électronique Grand Public",
    "de-DE": "Unterhaltungselektronik",
    "ja-JP": "家電製品"
  },
  description: {
    "en-US": "Electronic devices and accessories for personal use",
    "es-ES": "Dispositivos electrónicos y accesorios para uso personal",
    "fr-FR": "Appareils électroniques et accessoires à usage personnel",
    "de-DE": "Elektronische Geräte und Zubehör für den persönlichen Gebrauch",
    "ja-JP": "個人使用のための電子機器とアクセサリー"
  },
  status: "active",
  external_references: {
    unspsc: "52160000",
    eclass: "27-01-01-01"
  },
  attribute_definitions: {
    brand: {
      type: "text",
      label: {
        "en-US": "Brand",
        "es-ES": "Marca",
        "fr-FR": "Marque",
        "de-DE": "Marke",
        "ja-JP": "ブランド"
      },
      is_required: true,
      is_searchable: true,
      validation: {
        min_length: 1,
        max_length: 100
      }
    },
    model_number: {
      type: "text",
      label: {
        "en-US": "Model Number",
        "es-ES": "Número de Modelo",
        "fr-FR": "Numéro de Modèle",
        "de-DE": "Modellnummer",
        "ja-JP": "型番"
      },
      is_required: true,
      is_unique: true,
      validation: {
        pattern: "^[A-Z0-9-]+$"
      }
    },
    warranty_period: {
      type: "select",
      label: {
        "en-US": "Warranty Period",
        "es-ES": "Período de Garantía",
        "fr-FR": "Période de Garantie",
        "de-DE": "Garantiezeitraum",
        "ja-JP": "保証期間"
      },
      options: [
        {
          value: "90days",
          label: {
            "en-US": "90 Days",
            "es-ES": "90 Días",
            "fr-FR": "90 Jours",
            "de-DE": "90 Tage",
            "ja-JP": "90日"
          }
        },
        {
          value: "1year",
          label: {
            "en-US": "1 Year",
            "es-ES": "1 Año",
            "fr-FR": "1 An",
            "de-DE": "1 Jahr",
            "ja-JP": "1年"
          }
        },
        {
          value: "2years",
          label: {
            "en-US": "2 Years",
            "es-ES": "2 Años",
            "fr-FR": "2 Ans",
            "de-DE": "2 Jahre",
            "ja-JP": "2年"
          }
        }
      ],
      default_value: "1year"
    },
    energy_rating: {
      type: "select",
      label: {
        "en-US": "Energy Efficiency Rating",
        "es-ES": "Calificación de Eficiencia Energética",
        "fr-FR": "Classe d'Efficacité Énergétique",
        "de-DE": "Energieeffizienzklasse"
      },
      options: [
        { value: "A+++", label: "A+++" },
        { value: "A++", label: "A++" },
        { value: "A+", label: "A+" },
        { value: "A", label: "A" },
        { value: "B", label: "B" },
        { value: "C", label: "C" }
      ],
      is_searchable: true
    }
  },
  required_attributes: ["brand", "model_number"],
  category_path: ["electronics", "consumer"],
  version: "2.0.0",
  applicable_regions: ["US", "CA", "EU", "JP"],
  extensions: {
    compliance: {
      ce_marking_required: true,
      fcc_approval_required: true,
      rohs_compliant: true
    },
    display: {
      show_energy_label: true,
      comparison_enabled: true
    }
  }
};

/**
 * Sample complex B2B industrial product type
 */
export const sampleIndustrialProductType: MACHProductType = {
  id: "PT-INDUSTRIAL-PUMP-001",
  name: "Industrial Centrifugal Pumps",
  description: "High-performance centrifugal pumps for industrial applications",
  status: "active",
  parent_type_id: "PT-INDUSTRIAL-EQUIPMENT",
  external_references: {
    unspsc: "40151500",
    eclass: "36-01-01-01",
    sap_material_type: "PUMP"
  },
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2024-07-01T14:30:00Z",
  version: "3.2.0",
  attribute_definitions: {
    flow_rate: {
      type: "number",
      label: "Flow Rate",
      description: "Maximum flow rate at optimal efficiency",
      is_required: true,
      is_searchable: true,
      unit: "m³/h",
      validation: {
        min: 0,
        max: 10000
      },
      source: "engineering_system"
    },
    head_pressure: {
      type: "number",
      label: "Head Pressure",
      description: "Maximum head pressure",
      is_required: true,
      is_searchable: true,
      unit: "m",
      validation: {
        min: 0,
        max: 500
      },
      source: "engineering_system"
    },
    motor_power: {
      type: "number",
      label: "Motor Power",
      is_required: true,
      is_searchable: true,
      unit: "kW",
      validation: {
        min: 0.1,
        max: 1000
      },
      source: "engineering_system"
    },
    inlet_diameter: {
      type: "dimension",
      label: "Inlet Diameter",
      is_required: true,
      unit: "mm",
      validation: {
        min: 25,
        max: 600
      },
      source: "engineering_system"
    },
    outlet_diameter: {
      type: "dimension",
      label: "Outlet Diameter",
      is_required: true,
      unit: "mm",
      validation: {
        min: 25,
        max: 500
      },
      source: "engineering_system"
    },
    material_construction: {
      type: "multiselect",
      label: "Materials of Construction",
      is_required: true,
      options: [
        { value: "cast_iron", label: "Cast Iron" },
        { value: "stainless_316", label: "Stainless Steel 316" },
        { value: "duplex", label: "Duplex Stainless Steel" },
        { value: "bronze", label: "Bronze" },
        { value: "hastelloy", label: "Hastelloy" }
      ],
      source: "engineering_system"
    },
    certifications: {
      type: "multiselect",
      label: "Certifications",
      options: [
        { value: "atex", label: "ATEX Explosion Proof" },
        { value: "api610", label: "API 610 Compliant" },
        { value: "iso9001", label: "ISO 9001" },
        { value: "ce", label: "CE Marked" },
        { value: "ul", label: "UL Listed" }
      ],
      source: "compliance_system"
    },
    npsh_required: {
      type: "number",
      label: "NPSH Required",
      description: "Net Positive Suction Head required",
      unit: "m",
      validation: {
        min: 0,
        max: 50
      },
      source: "engineering_system"
    },
    efficiency_curve: {
      type: "json",
      label: "Efficiency Curve Data",
      description: "Performance curve data points",
      is_required: false,
      source: "engineering_system"
    },
    cad_drawing_url: {
      type: "url",
      label: "CAD Drawing Link",
      is_required: false,
      validation: {
        pattern: "^https?://.*\\.(dwg|dxf|step|iges)$"
      },
      source: "engineering_system"
    },
    spare_parts_list: {
      type: "json",
      label: "Spare Parts List",
      description: "List of spare parts with part numbers",
      is_required: false,
      source: "erp_system"
    }
  },
  required_attributes: [
    "flow_rate",
    "head_pressure",
    "motor_power",
    "inlet_diameter",
    "outlet_diameter",
    "material_construction"
  ],
  category_path: ["industrial", "pumps", "centrifugal"],
  tags: ["b2b", "industrial", "rotating-equipment", "api-compliant"],
  applicable_channels: ["b2b-portal", "dealer-network"],
  applicable_regions: ["global"],
  extensions: {
    engineering: {
      design_standard: "API 610",
      impeller_type: "closed",
      seal_type: "mechanical",
      bearing_type: "anti-friction"
    },
    procurement: {
      lead_time_days: 45,
      minimum_order_quantity: 1,
      country_of_origin_required: true
    },
    service: {
      mtbf_hours: 25000,
      recommended_service_interval: "6months",
      warranty_conditions: "standard_industrial"
    },
    pricing: {
      pricing_model: "quote_based",
      volume_discounts_available: true
    }
  }
};
