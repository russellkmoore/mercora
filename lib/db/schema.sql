-- MACH Alliance Open Data Model Compliant Database Schema
-- Mercora - First MACH Alliance Open Data Model Compliant Platform

-- =====================================================
-- MACH Utility Objects
-- =====================================================

-- Address Table - Based on MACH Alliance Address specification
-- https://github.com/machalliance/standards/blob/main/models/entities/utilities/address.md
CREATE TABLE addresses (
    -- Core identification
    id TEXT PRIMARY KEY,
    
    -- Classification
    type TEXT DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing', 'business', 'residential', 'mailing', 'pickup')),
    status TEXT DEFAULT 'unverified' CHECK (status IN ('active', 'invalid', 'undeliverable', 'verified', 'unverified')),
    
    -- Required fields (MUST have according to MACH spec)
    line1 TEXT NOT NULL, -- Primary address line
    city TEXT NOT NULL, -- City, town, or locality name
    country TEXT NOT NULL CHECK (length(country) = 2), -- ISO 3166-1 alpha-2 country code
    
    -- Optional address lines
    line2 TEXT, -- Secondary address line (apartment, suite, unit)
    line3 TEXT, -- Additional address line (building, complex name)
    line4 TEXT, -- Extra address line for complex addresses
    
    -- Location components
    district TEXT, -- District, neighborhood, or borough
    region TEXT, -- State, province, or administrative region
    postal_code TEXT, -- Postal code, ZIP code, or postcode
    
    -- Geographic data (stored as JSON for coordinates object)
    coordinates TEXT, -- JSON: {latitude, longitude, altitude?, accuracy?}
    formatted TEXT, -- Pre-formatted complete address string
    
    -- Contact information
    company TEXT, -- Company or organization name
    recipient TEXT, -- Recipient name for delivery
    phone TEXT, -- Contact phone number for delivery (E.164 format recommended)
    email TEXT, -- Contact email for delivery notifications
    
    -- Delivery details
    delivery_instructions TEXT, -- Special delivery instructions or notes
    access_codes TEXT, -- Gate codes, building access information
    
    -- Validation metadata (stored as JSON)
    validation TEXT, -- JSON: validation object with provider, confidence_score, etc.
    
    -- Additional attributes (stored as JSON)
    attributes TEXT, -- JSON: Additional address-specific attributes
    
    -- Timestamps
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp  
    verified_at TEXT, -- ISO 8601 verification timestamp
    
    -- Extensions (stored as JSON)
    extensions TEXT -- JSON: Namespaced dictionary for extension data
);

-- Create indexes for common queries
CREATE INDEX idx_addresses_type ON addresses(type);
CREATE INDEX idx_addresses_status ON addresses(status);
CREATE INDEX idx_addresses_country ON addresses(country);
CREATE INDEX idx_addresses_region ON addresses(region);
CREATE INDEX idx_addresses_postal_code ON addresses(postal_code);
CREATE INDEX idx_addresses_recipient ON addresses(recipient);
CREATE INDEX idx_addresses_created_at ON addresses(created_at);

-- =====================================================
-- MACH Product Entities
-- =====================================================

-- Category Table - Based on MACH Alliance Category specification
-- https://github.com/machalliance/standards/blob/main/models/entities/product/category.md
CREATE TABLE categories (
    -- Core identification - REQUIRED
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- Display name (stored as JSON for localization)
    
    -- Display information - OPTIONAL
    description TEXT, -- Detailed description (stored as JSON for localization)
    slug TEXT, -- URL-friendly identifier (stored as JSON for localization)
    
    -- Status and hierarchy - OPTIONAL
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    parent_id TEXT, -- Parent category identifier for hierarchy
    position INTEGER, -- Sort order within parent category
    path TEXT, -- Full category path for breadcrumbs (e.g., /clothing/shirts)
    
    -- External references - OPTIONAL
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (PIM, ERP, Commerce)
    
    -- Timestamps - OPTIONAL
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Hierarchy and products - OPTIONAL
    children TEXT, -- JSON: Array of child category references
    product_count INTEGER DEFAULT 0, -- Number of products in this category
    
    -- Metadata and classification - OPTIONAL
    attributes TEXT, -- JSON: Additional metadata schemas or search filters
    tags TEXT, -- JSON: Array of tags for filtering and search
    
    -- Media assets - OPTIONAL
    primary_image TEXT, -- JSON: Primary category image (Media object)
    media TEXT, -- JSON: Additional images and assets array
    
    -- SEO - OPTIONAL
    seo TEXT, -- JSON: SEO metadata object (meta_title, meta_description, etc.)
    
    -- Extensions - OPTIONAL
    extensions TEXT, -- JSON: Namespaced dictionary for extension data
    
    -- Foreign key constraint for self-referencing hierarchy
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Create indexes for category queries and performance
CREATE INDEX idx_categories_status ON categories(status);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_position ON categories(position);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_created_at ON categories(created_at);
CREATE INDEX idx_categories_product_count ON categories(product_count);

-- Composite index for hierarchy queries (parent + position)
CREATE INDEX idx_categories_hierarchy ON categories(parent_id, position);

-- Index for full-text search on names (for JSON content)
CREATE INDEX idx_categories_name_search ON categories(name);

-- =====================================================
-- MACH Promotion Entities
-- =====================================================

-- Coupon Instance Table - Based on MACH Alliance CouponInstance specification  
-- https://github.com/machalliance/standards/blob/main/models/entities/promotion/coupon-instance.md
CREATE TABLE coupon_instances (
    -- Core identification - REQUIRED
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- The actual coupon code string used by customers  
    promotion_id TEXT NOT NULL, -- Reference to parent Promotion entity
    
    -- Status and type - OPTIONAL  
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'disabled', 'reserved')),
    type TEXT DEFAULT 'single_use' CHECK (type IN ('single_use', 'multi_use', 'unlimited')),
    
    -- External references - OPTIONAL
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (CRM, Campaign, etc.)
    
    -- Timestamps - OPTIONAL
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Assignment and validity - OPTIONAL
    assigned_to TEXT, -- Customer ID or segment this coupon is assigned to
    valid_from TEXT, -- ISO 8601 start timestamp for coupon availability
    valid_to TEXT, -- ISO 8601 end timestamp for coupon expiration
    
    -- Usage tracking - OPTIONAL
    usage_count INTEGER DEFAULT 0 NOT NULL, -- Number of times this coupon has been used
    usage_limit INTEGER, -- Maximum allowed uses for this specific instance
    last_used_at TEXT, -- ISO 8601 timestamp of last redemption
    last_used_by TEXT, -- Customer ID of last user
    
    -- Generation tracking - OPTIONAL  
    generation_batch TEXT, -- Batch identifier for bulk-generated coupons
    
    -- Extensions - OPTIONAL
    extensions TEXT -- JSON: Namespaced dictionary for extension data
);

-- Create indexes for coupon instance queries and performance
CREATE INDEX idx_coupon_instances_code ON coupon_instances(code);
CREATE INDEX idx_coupon_instances_promotion_id ON coupon_instances(promotion_id);
CREATE INDEX idx_coupon_instances_status ON coupon_instances(status);
CREATE INDEX idx_coupon_instances_type ON coupon_instances(type);
CREATE INDEX idx_coupon_instances_assigned_to ON coupon_instances(assigned_to);
CREATE INDEX idx_coupon_instances_valid_from ON coupon_instances(valid_from);
CREATE INDEX idx_coupon_instances_valid_to ON coupon_instances(valid_to);
CREATE INDEX idx_coupon_instances_usage_count ON coupon_instances(usage_count);
CREATE INDEX idx_coupon_instances_last_used_at ON coupon_instances(last_used_at);
CREATE INDEX idx_coupon_instances_last_used_by ON coupon_instances(last_used_by);
CREATE INDEX idx_coupon_instances_generation_batch ON coupon_instances(generation_batch);
CREATE INDEX idx_coupon_instances_created_at ON coupon_instances(created_at);

-- Composite indexes for complex queries
CREATE INDEX idx_coupon_instances_active_valid ON coupon_instances(status, valid_from, valid_to);
CREATE INDEX idx_coupon_instances_usage_tracking ON coupon_instances(type, usage_count, usage_limit);
CREATE INDEX idx_coupon_instances_assignment ON coupon_instances(assigned_to, status, valid_to);

-- =====================================================
-- MACH Identity Entities
-- =====================================================

-- Customer Table - Based on MACH Alliance Customer specification
-- https://github.com/machalliance/standards/blob/main/models/entities/identity/customer.md
CREATE TABLE customers (
    -- Core identification - REQUIRED
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('person', 'company')), -- Customer type classification
    
    -- Status and lifecycle - OPTIONAL
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'archived', 'pending_verification')),
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (CRM, ERP, CDP, etc.)
    
    -- Timestamps - OPTIONAL
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Person-specific data (B2C) - OPTIONAL
    person TEXT, -- JSON: MACHPersonData object (first_name, last_name, email, etc.)
    
    -- Company-specific data (B2B) - OPTIONAL
    company TEXT, -- JSON: MACHCompanyData object (name, legal_form, registration_number, etc.)
    
    -- Contact persons (primarily for B2B) - OPTIONAL
    contacts TEXT, -- JSON: Array of MACHContactPerson objects
    
    -- Addresses - OPTIONAL
    addresses TEXT, -- JSON: Array of MACHCustomerAddress objects (billing, shipping, service, etc.)
    
    -- Communication preferences - OPTIONAL
    communication_preferences TEXT, -- JSON: MACHCommunicationPreferences object (email, sms, preferences)
    
    -- Segmentation - OPTIONAL
    segments TEXT, -- JSON: Array of segment strings for targeting
    tags TEXT, -- JSON: Array of tag strings for categorization
    
    -- Loyalty information - OPTIONAL
    loyalty TEXT, -- JSON: MACHLoyaltyInfo object (program, points, tier, etc.)
    
    -- Authentication settings - OPTIONAL
    authentication TEXT, -- JSON: MACHAuthenticationSettings object (2FA, verification status)
    
    -- Extensions - OPTIONAL
    extensions TEXT -- JSON: Namespaced dictionary for extension data
);

-- Create indexes for customer queries and performance
CREATE INDEX idx_customers_type ON customers(type);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_updated_at ON customers(updated_at);

-- Indexes for JSON field searches (when supported by database)
-- Note: These are conceptual - SQLite with Cloudflare D1 may require different approaches
CREATE INDEX idx_customers_person_email ON customers(json_extract(person, '$.email')) WHERE person IS NOT NULL;
CREATE INDEX idx_customers_company_name ON customers(json_extract(company, '$.name')) WHERE company IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_customers_type_status ON customers(type, status);
CREATE INDEX idx_customers_active_recent ON customers(status, created_at) WHERE status = 'active';

-- =====================================================
-- MACH Inventory Objects  
-- =====================================================

-- Inventory Table - Based on MACH Alliance Inventory specification
-- https://github.com/machalliance/standards/blob/main/models/entities/inventory/inventory.md
CREATE TABLE inventory (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL, -- Reference to the SKU/product variant
    location_id TEXT NOT NULL, -- Reference to the inventory location
    
    -- Stock quantities (REQUIRED) - stored as JSON for flexibility
    quantities TEXT NOT NULL, -- JSON: {on_hand, reserved, available, incoming?, allocated?, damaged?}
    
    -- Status and state (OPTIONAL)
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
    stock_status TEXT CHECK (stock_status IN ('in_stock', 'out_of_stock', 'backorder', 'preorder')),
    
    -- External references (OPTIONAL) - stored as JSON
    external_references TEXT, -- JSON: {wms_id, erp_id, 3pl_id, etc.}
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 timestamp
    updated_at TEXT, -- ISO 8601 timestamp
    
    -- Policy and rules (OPTIONAL)
    policy_id TEXT, -- Reference to inventory policy ruleset
    backorderable INTEGER DEFAULT 0 CHECK (backorderable IN (0, 1)), -- Boolean: allow overselling
    backorder_eta TEXT, -- ISO 8601 timestamp for expected replenishment
    safety_stock INTEGER DEFAULT 0 CHECK (safety_stock >= 0), -- Buffer quantity
    
    -- Concurrency control (RECOMMENDED)
    version INTEGER DEFAULT 0 CHECK (version >= 0), -- Optimistic locking version
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced extension data
);

-- Indexes for inventory table

-- Primary access patterns
CREATE INDEX idx_inventory_sku_location ON inventory(sku_id, location_id);
CREATE INDEX idx_inventory_sku ON inventory(sku_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);

-- Status-based queries
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_stock_status ON inventory(stock_status);
CREATE INDEX idx_inventory_backorderable ON inventory(backorderable) WHERE backorderable = 1;

-- Policy-based queries
CREATE INDEX idx_inventory_policy ON inventory(policy_id) WHERE policy_id IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_inventory_updated ON inventory(updated_at);
CREATE INDEX idx_inventory_created ON inventory(created_at);

-- Concurrency control
CREATE INDEX idx_inventory_version ON inventory(version);

-- Composite indexes for common business queries
CREATE INDEX idx_inventory_sku_status ON inventory(sku_id, status);
CREATE INDEX idx_inventory_location_status ON inventory(location_id, status);
CREATE INDEX idx_inventory_active_stock ON inventory(status, stock_status) WHERE status = 'active';

-- JSON field indexes for performance (conceptual - actual implementation may vary)
-- These would allow fast queries on quantities and external references
CREATE INDEX idx_inventory_on_hand ON inventory(json_extract(quantities, '$.on_hand'));
CREATE INDEX idx_inventory_available ON inventory(json_extract(quantities, '$.available'));
CREATE INDEX idx_inventory_wms_id ON inventory(json_extract(external_references, '$.wms_id')) WHERE external_references IS NOT NULL;

-- =====================================================
-- MACH Language Utilities
-- =====================================================

-- Language Table - Based on MACH Alliance Language specification
-- https://github.com/machalliance/standards/blob/main/models/entities/utilities/language.md
CREATE TABLE languages (
    -- Core identification (REQUIRED)
    code TEXT PRIMARY KEY, -- ISO 639-1 language code (e.g., "en", "es", "fr")
    name TEXT NOT NULL, -- Language name (stored as JSON for localization)
    locale TEXT NOT NULL UNIQUE, -- Full locale identifier (e.g., "en-US", "es-MX")
    
    -- Regional and script information (OPTIONAL)
    region TEXT, -- ISO 3166-1 alpha-2 region/country code  
    script TEXT, -- ISO 15924 script code (e.g., "Latn", "Cyrl", "Arab", "Hans")
    direction TEXT DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')), -- Text direction
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'experimental')),
    
    -- External references (OPTIONAL) - stored as JSON
    external_references TEXT, -- JSON: {cldr_id, icu_id, translation_system_id, etc.}
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 timestamp
    updated_at TEXT, -- ISO 8601 timestamp
    
    -- Formatting and localization (OPTIONAL) - stored as JSON
    formatting TEXT, -- JSON: MACHLocaleFormatting object (date, time, number, currency formats)
    fallback_locales TEXT, -- JSON: Array of fallback locale strings for graceful degradation
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced extension data
);

-- Indexes for language table

-- Primary access patterns  
CREATE INDEX idx_languages_locale ON languages(locale);
CREATE INDEX idx_languages_code ON languages(code);
CREATE INDEX idx_languages_region ON languages(region) WHERE region IS NOT NULL;

-- Status and feature-based queries
CREATE INDEX idx_languages_status ON languages(status);
CREATE INDEX idx_languages_direction ON languages(direction);
CREATE INDEX idx_languages_script ON languages(script) WHERE script IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_languages_created ON languages(created_at);
CREATE INDEX idx_languages_updated ON languages(updated_at);

-- Composite indexes for common queries
CREATE INDEX idx_languages_active ON languages(status) WHERE status = 'active';
CREATE INDEX idx_languages_region_status ON languages(region, status) WHERE region IS NOT NULL;
CREATE INDEX idx_languages_script_direction ON languages(script, direction) WHERE script IS NOT NULL;

-- JSON field indexes for formatting queries (conceptual)
CREATE INDEX idx_languages_currency_code ON languages(json_extract(formatting, '$.currency_format.code')) WHERE formatting IS NOT NULL;
CREATE INDEX idx_languages_measurement_system ON languages(json_extract(formatting, '$.measurement_system')) WHERE formatting IS NOT NULL;

-- =====================================================
-- MACH Media Utilities
-- =====================================================

-- Media Table - Based on MACH Alliance Media specification
-- https://github.com/machalliance/standards/blob/main/models/entities/utilities/media.md
CREATE TABLE media (
    -- Core identification (OPTIONAL - but using id as primary key)
    id TEXT PRIMARY KEY, -- Unique identifier for the media asset
    type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video', 'document', 'audio', '3d')), -- Type of media asset
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'published', 'active', 'archived', 'deleted')), -- Lifecycle status
    
    -- External references (OPTIONAL) - stored as JSON
    external_references TEXT, -- JSON: {dam_id, pim_id, cms_id, youtube_id, etc.}
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 timestamp
    updated_at TEXT, -- ISO 8601 timestamp
    
    -- Display information (OPTIONAL) - stored as JSON for localization
    title TEXT, -- JSON: string or localized object
    description TEXT, -- JSON: string or localized object
    
    -- Categorization (OPTIONAL)
    tags TEXT, -- JSON: Array of taxonomy keywords
    
    -- Core file information (REQUIRED) - stored as JSON
    file TEXT NOT NULL, -- JSON: MACHFile object with url, format, size, dimensions
    
    -- Media variants and derivatives (OPTIONAL) - stored as JSON
    variants TEXT, -- JSON: Array of MACHMediaVariant objects
    thumbnail TEXT, -- JSON: MACHFile object for thumbnail
    focal_point TEXT, -- JSON: MACHFocalPoint object for intelligent cropping
    
    -- Accessibility (OPTIONAL) - stored as JSON
    accessibility TEXT, -- JSON: MACHAccessibility object (alt_text, captions, etc.)
    
    -- Technical metadata (OPTIONAL) - stored as JSON
    metadata TEXT, -- JSON: Technical metadata (EXIF, dimensions, duration)
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced extension data
);

-- Indexes for media table

-- Primary access patterns
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_status ON media(status);
CREATE INDEX idx_media_type_status ON media(type, status);

-- Timestamp-based queries
CREATE INDEX idx_media_created_at ON media(created_at);
CREATE INDEX idx_media_updated_at ON media(updated_at);

-- Tag-based queries (for JSON array search)
CREATE INDEX idx_media_tags ON media(tags) WHERE tags IS NOT NULL;

-- Status-based queries
CREATE INDEX idx_media_active ON media(status) WHERE status = 'active';
CREATE INDEX idx_media_published ON media(status) WHERE status IN ('published', 'active');

-- JSON field indexes for common queries (conceptual)
CREATE INDEX idx_media_file_format ON media(json_extract(file, '$.format')) WHERE file IS NOT NULL;
CREATE INDEX idx_media_file_url ON media(json_extract(file, '$.url')) WHERE file IS NOT NULL;
CREATE INDEX idx_media_external_dam ON media(json_extract(external_references, '$.dam_id')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_media_external_pim ON media(json_extract(external_references, '$.pim_id')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_media_external_cms ON media(json_extract(external_references, '$.cms_id')) WHERE external_references IS NOT NULL;

-- =====================================================
-- MACH Pricing Entities
-- =====================================================

-- Pricing Table - Based on MACH Alliance Pricing specification
-- https://github.com/machalliance/standards/blob/main/models/entities/pricing/pricing.md
CREATE TABLE pricing (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY, -- Unique identifier for the pricing record
    product_id TEXT NOT NULL, -- Reference to the product/SKU this pricing applies to
    
    -- Price values (REQUIRED) - stored as JSON for MACHMoney objects
    list_price TEXT NOT NULL, -- JSON: MACHMoney object (MSRP)
    sale_price TEXT NOT NULL, -- JSON: MACHMoney object (actual selling price)
    
    -- Classification and status (OPTIONAL)
    type TEXT DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale', 'bulk', 'contract', 'dynamic')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'scheduled', 'expired', 'draft')),
    
    -- External references (OPTIONAL) - stored as JSON
    external_references TEXT, -- JSON: {pms_id, erp_id, promotion_id, etc.}
    
    -- Timestamps (OPTIONAL)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- ISO 8601 creation timestamp
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- ISO 8601 update timestamp
    valid_from TEXT, -- ISO 8601 start timestamp for price validity
    valid_to TEXT, -- ISO 8601 end timestamp for price validity
    
    -- Associations (OPTIONAL)
    campaign_id TEXT, -- Associated campaign identifier
    pricelist_id TEXT, -- Associated price list identifier
    catalog_id TEXT, -- Associated catalog context identifier
    
    -- Tax information (OPTIONAL) - stored as JSON
    tax TEXT, -- JSON: MACHTaxInfo object (included, rate, type, amount)
    
    -- Additional pricing context (OPTIONAL)
    currency_code TEXT CHECK (length(currency_code) = 3), -- ISO 4217 currency code override
    minimum_quantity INTEGER DEFAULT 1 CHECK (minimum_quantity >= 1), -- Minimum quantity for this price
    customer_segment_id TEXT, -- Specific customer segment this price applies to
    channel_id TEXT, -- Sales channel this price is valid for
    region_id TEXT, -- Geographic region this price applies to
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced extension data (bulk pricing, dynamic rules, etc.)
);

-- Indexes for pricing table

-- Primary access patterns
CREATE INDEX idx_pricing_product_id ON pricing(product_id);
CREATE INDEX idx_pricing_status ON pricing(status);
CREATE INDEX idx_pricing_type ON pricing(type);

-- Association-based queries
CREATE INDEX idx_pricing_pricelist_id ON pricing(pricelist_id) WHERE pricelist_id IS NOT NULL;
CREATE INDEX idx_pricing_campaign_id ON pricing(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_pricing_catalog_id ON pricing(catalog_id) WHERE catalog_id IS NOT NULL;

-- Segmentation and targeting
CREATE INDEX idx_pricing_customer_segment ON pricing(customer_segment_id) WHERE customer_segment_id IS NOT NULL;
CREATE INDEX idx_pricing_channel_id ON pricing(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_pricing_region_id ON pricing(region_id) WHERE region_id IS NOT NULL;

-- Validity and time-based queries
CREATE INDEX idx_pricing_valid_from ON pricing(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_pricing_valid_to ON pricing(valid_to) WHERE valid_to IS NOT NULL;
CREATE INDEX idx_pricing_validity_range ON pricing(valid_from, valid_to) WHERE valid_from IS NOT NULL AND valid_to IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_pricing_created_at ON pricing(created_at);
CREATE INDEX idx_pricing_updated_at ON pricing(updated_at);

-- Composite indexes for common business queries
CREATE INDEX idx_pricing_product_status ON pricing(product_id, status);
CREATE INDEX idx_pricing_product_type ON pricing(product_id, type);
CREATE INDEX idx_pricing_active ON pricing(status) WHERE status = 'active';
CREATE INDEX idx_pricing_active_valid ON pricing(status, valid_from, valid_to) WHERE status = 'active';
CREATE INDEX idx_pricing_type_status ON pricing(type, status);

-- Business context composite indexes
CREATE INDEX idx_pricing_segment_channel ON pricing(customer_segment_id, channel_id) WHERE customer_segment_id IS NOT NULL AND channel_id IS NOT NULL;
CREATE INDEX idx_pricing_campaign_status ON pricing(campaign_id, status) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_pricing_pricelist_status ON pricing(pricelist_id, status) WHERE pricelist_id IS NOT NULL;

-- JSON field indexes for common queries (conceptual)
CREATE INDEX idx_pricing_list_amount ON pricing(json_extract(list_price, '$.amount')) WHERE list_price IS NOT NULL;
CREATE INDEX idx_pricing_sale_amount ON pricing(json_extract(sale_price, '$.amount')) WHERE sale_price IS NOT NULL;
CREATE INDEX idx_pricing_list_currency ON pricing(json_extract(list_price, '$.currency')) WHERE list_price IS NOT NULL;
CREATE INDEX idx_pricing_sale_currency ON pricing(json_extract(sale_price, '$.currency')) WHERE sale_price IS NOT NULL;
CREATE INDEX idx_pricing_external_pms ON pricing(json_extract(external_references, '$.pms_id')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_pricing_external_erp ON pricing(json_extract(external_references, '$.erp_id')) WHERE external_references IS NOT NULL;

-- =====================================================
-- MACH Product Entities
-- =====================================================

-- Products Table - Based on MACH Alliance Product specification
-- https://github.com/machalliance/standards/blob/main/models/entities/product/product.md
CREATE TABLE products (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY, -- Unique identifier for the product
    name TEXT NOT NULL, -- JSON: string or localized object - product name
    
    -- Classification and status (OPTIONAL)
    type TEXT, -- Reference to Product Type for classification
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (ERP, PIM, etc.)
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Display information (OPTIONAL) - stored as JSON for localization
    description TEXT, -- JSON: string or localized object - product description
    slug TEXT, -- URL-friendly string for routing and SEO
    brand TEXT, -- Brand name or identifier
    
    -- Categorization (OPTIONAL) - stored as JSON arrays
    categories TEXT, -- JSON: Array of category references
    tags TEXT, -- JSON: Array of tags for filtering and search
    
    -- Variant configuration (OPTIONAL)
    options TEXT, -- JSON: Array of MACHProductOption objects for variants
    default_variant_id TEXT, -- ID of the primary/master variant
    
    -- Fulfillment and tax (OPTIONAL)
    fulfillment_type TEXT DEFAULT 'physical' CHECK (fulfillment_type IN ('physical', 'digital', 'service')),
    tax_category TEXT, -- Default tax classification for the product
    
    -- Media assets (OPTIONAL) - stored as JSON for Media objects
    primary_image TEXT, -- JSON: MACHMedia object - primary product image
    media TEXT, -- JSON: Array of MACHMedia objects - additional images, videos, docs
    
    -- SEO and ratings (OPTIONAL) - stored as JSON
    seo TEXT, -- JSON: MACHSEO object - metadata for search engine optimization
    rating TEXT, -- JSON: MACHRating object - aggregated customer review information
    
    -- Relationships (OPTIONAL) - stored as JSON
    related_products TEXT, -- JSON: Array of related product IDs
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced dictionary for extension data
);

-- Product Variants Table - Based on MACH Alliance ProductVariant specification
-- For separate entities approach (Option 2)
CREATE TABLE product_variants (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY, -- Unique identifier for the variant
    product_id TEXT NOT NULL, -- Reference to parent product (Option 2 only)
    sku TEXT NOT NULL UNIQUE, -- Stock Keeping Unit - unique identifier
    option_values TEXT NOT NULL, -- JSON: Array of MACHOptionValue objects for this variant
    price TEXT NOT NULL, -- JSON: MACHMoney object - variant pricing
    
    -- Status and ordering (OPTIONAL)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    position INTEGER, -- Sort order for display purposes
    
    -- Pricing (OPTIONAL) - stored as JSON for MACHMoney objects
    compare_at_price TEXT, -- JSON: MACHMoney object - original/MSRP price for discounts
    cost TEXT, -- JSON: MACHMoney object - cost of goods for margin calculations
    
    -- Physical attributes (OPTIONAL) - stored as JSON
    weight TEXT, -- JSON: MACHWeight object - physical weight for shipping calculations
    dimensions TEXT, -- JSON: MACHDimensions object - physical dimensions
    barcode TEXT, -- Barcode (UPC, EAN, ISBN, etc.)
    
    -- Commerce (OPTIONAL)
    inventory TEXT, -- JSON: MACHProductInventory object - simplified inventory info
    tax_category TEXT, -- Tax classification override (if different from product)
    shipping_required INTEGER DEFAULT 1 CHECK (shipping_required IN (0, 1)), -- Boolean: physical shipping needed
    
    -- Media and attributes (OPTIONAL) - stored as JSON
    media TEXT, -- JSON: Array of MACHMedia objects - variant-specific images
    attributes TEXT, -- JSON: Additional variant-specific attributes
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Foreign key constraint
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexes for products table

-- Primary access patterns
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_type ON products(type) WHERE type IS NOT NULL;
CREATE INDEX idx_products_brand ON products(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_products_slug ON products(slug) WHERE slug IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_updated_at ON products(updated_at);

-- Fulfillment and classification
CREATE INDEX idx_products_fulfillment_type ON products(fulfillment_type);
CREATE INDEX idx_products_tax_category ON products(tax_category) WHERE tax_category IS NOT NULL;

-- Default variant reference
CREATE INDEX idx_products_default_variant ON products(default_variant_id) WHERE default_variant_id IS NOT NULL;

-- Status-based queries
CREATE INDEX idx_products_active ON products(status) WHERE status = 'active';
CREATE INDEX idx_products_published ON products(status) WHERE status IN ('active', 'archived');

-- Composite indexes for common queries
CREATE INDEX idx_products_status_type ON products(status, type) WHERE type IS NOT NULL;
CREATE INDEX idx_products_brand_status ON products(brand, status) WHERE brand IS NOT NULL;
CREATE INDEX idx_products_fulfillment_status ON products(fulfillment_type, status);

-- JSON field indexes for common queries (conceptual)
CREATE INDEX idx_products_categories ON products(categories) WHERE categories IS NOT NULL;
CREATE INDEX idx_products_tags ON products(tags) WHERE tags IS NOT NULL;
CREATE INDEX idx_products_external_erp ON products(json_extract(external_references, '$.erp_id')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_products_external_pim ON products(json_extract(external_references, '$.pim_id')) WHERE external_references IS NOT NULL;

-- Indexes for product_variants table

-- Primary access patterns
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_status ON product_variants(status);
CREATE INDEX idx_product_variants_position ON product_variants(position) WHERE position IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_product_variants_created_at ON product_variants(created_at);
CREATE INDEX idx_product_variants_updated_at ON product_variants(updated_at);

-- Commerce attributes
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_product_variants_tax_category ON product_variants(tax_category) WHERE tax_category IS NOT NULL;
CREATE INDEX idx_product_variants_shipping_required ON product_variants(shipping_required);

-- Status-based queries
CREATE INDEX idx_product_variants_active ON product_variants(status) WHERE status = 'active';
CREATE INDEX idx_product_variants_available ON product_variants(status) WHERE status IN ('active', 'inactive');

-- Composite indexes for common business queries
CREATE INDEX idx_product_variants_product_status ON product_variants(product_id, status);
CREATE INDEX idx_product_variants_product_position ON product_variants(product_id, position) WHERE position IS NOT NULL;
CREATE INDEX idx_product_variants_sku_status ON product_variants(sku, status);

-- JSON field indexes for pricing and inventory (conceptual)
CREATE INDEX idx_product_variants_price_amount ON product_variants(json_extract(price, '$.amount')) WHERE price IS NOT NULL;
CREATE INDEX idx_product_variants_price_currency ON product_variants(json_extract(price, '$.currency')) WHERE price IS NOT NULL;
CREATE INDEX idx_product_variants_inventory_quantity ON product_variants(json_extract(inventory, '$.quantity')) WHERE inventory IS NOT NULL;
CREATE INDEX idx_product_variants_weight_value ON product_variants(json_extract(weight, '$.value')) WHERE weight IS NOT NULL;

-- =====================================================
-- MACH ProductType Entities
-- =====================================================

-- ProductType Table - Based on MACH Alliance ProductType specification
-- https://github.com/machalliance/standards/blob/main/models/entities/product/product-type.md
CREATE TABLE product_types (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY, -- Unique identifier for the product type
    name TEXT NOT NULL, -- JSON: string or localized object - product type name
    attribute_definitions TEXT NOT NULL, -- JSON: Dictionary of MACHAttributeDefinition objects
    
    -- Status and lifecycle (OPTIONAL)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (PIM, ERP, etc.)
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    
    -- Description and categorization (OPTIONAL) - stored as JSON for localization
    description TEXT, -- JSON: string or localized object - product type description
    parent_type_id TEXT, -- Parent type ID for inheritance hierarchy
    required_attributes TEXT, -- JSON: Array of required attribute keys
    category_path TEXT, -- JSON: Array of category path elements
    
    -- Versioning and metadata (OPTIONAL)
    version TEXT, -- Version identifier for type evolution
    tags TEXT, -- JSON: Array of tags for filtering and organization
    
    -- Channel and region applicability (OPTIONAL)
    applicable_channels TEXT, -- JSON: Array of channel IDs where this type applies
    applicable_regions TEXT, -- JSON: Array of region codes where this type applies
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT, -- JSON: namespaced dictionary for extension data
    
    -- Foreign key constraint for self-referencing hierarchy
    FOREIGN KEY (parent_type_id) REFERENCES product_types(id)
);

-- Indexes for product_types table

-- Primary access patterns
CREATE INDEX idx_product_types_status ON product_types(status);
CREATE INDEX idx_product_types_parent_type_id ON product_types(parent_type_id) WHERE parent_type_id IS NOT NULL;
CREATE INDEX idx_product_types_version ON product_types(version) WHERE version IS NOT NULL;

-- Timestamp-based queries
CREATE INDEX idx_product_types_created_at ON product_types(created_at);
CREATE INDEX idx_product_types_updated_at ON product_types(updated_at);

-- Hierarchy and organization
CREATE INDEX idx_product_types_hierarchy ON product_types(parent_type_id, status) WHERE parent_type_id IS NOT NULL;
CREATE INDEX idx_product_types_tags ON product_types(tags) WHERE tags IS NOT NULL;
CREATE INDEX idx_product_types_category_path ON product_types(category_path) WHERE category_path IS NOT NULL;

-- Channel and region targeting
CREATE INDEX idx_product_types_channels ON product_types(applicable_channels) WHERE applicable_channels IS NOT NULL;
CREATE INDEX idx_product_types_regions ON product_types(applicable_regions) WHERE applicable_regions IS NOT NULL;

-- Status-based queries
CREATE INDEX idx_product_types_active ON product_types(status) WHERE status = 'active';
CREATE INDEX idx_product_types_non_deprecated ON product_types(status) WHERE status != 'deprecated';

-- Composite indexes for common business queries
CREATE INDEX idx_product_types_status_version ON product_types(status, version) WHERE version IS NOT NULL;
CREATE INDEX idx_product_types_parent_status ON product_types(parent_type_id, status) WHERE parent_type_id IS NOT NULL;

-- JSON field indexes for attribute and reference queries (conceptual)
CREATE INDEX idx_product_types_required_attrs ON product_types(required_attributes) WHERE required_attributes IS NOT NULL;
CREATE INDEX idx_product_types_external_pim ON product_types(json_extract(external_references, '$.pim_id')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_product_types_external_erp ON product_types(json_extract(external_references, '$.erp_id')) WHERE external_references IS NOT NULL;

-- =====================================================
-- MACH Promotion Entities
-- =====================================================

-- Promotions Table - Based on MACH Alliance Promotion specification
-- https://github.com/machalliance/standards/blob/main/models/entities/promotion/promotion.md
CREATE TABLE promotions (
    -- Core identification (REQUIRED)
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- JSON: string or localized object - promotion name
    type TEXT NOT NULL CHECK (type IN ('cart', 'product', 'shipping')), -- What the promotion applies to
    rules TEXT NOT NULL, -- JSON: MACHPromotionRules object with conditions and actions
    
    -- Status and lifecycle (OPTIONAL)
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived')),
    description TEXT, -- JSON: string or localized object - promotion description
    slug TEXT, -- URL-friendly string for routing and SEO
    external_references TEXT, -- JSON: Dictionary of cross-system IDs (campaign, cms, etc.)
    
    -- Timestamps (OPTIONAL)
    created_at TEXT, -- ISO 8601 creation timestamp
    updated_at TEXT, -- ISO 8601 update timestamp
    valid_from TEXT, -- ISO 8601 start timestamp for promotion availability
    valid_to TEXT, -- ISO 8601 end timestamp for promotion expiration
    
    -- Activation and targeting (OPTIONAL)
    activation_method TEXT DEFAULT 'automatic' CHECK (activation_method IN ('automatic', 'code', 'customer_specific', 'link')),
    codes TEXT, -- JSON: MACHPromotionCodes object for code-based activation
    usage_limits TEXT, -- JSON: MACHUsageLimits object with usage restrictions
    eligibility TEXT, -- JSON: MACHEligibility object with customer and context criteria
    
    -- Stacking and priority (OPTIONAL)
    priority INTEGER DEFAULT 100 CHECK (priority >= 0 AND priority <= 1000), -- Higher number = higher priority
    stackable INTEGER DEFAULT 0 CHECK (stackable IN (0, 1)), -- Boolean: can be combined with others
    
    -- Extensions for custom data (OPTIONAL)
    extensions TEXT -- JSON: namespaced dictionary for extension data
);

-- Indexes for promotions table

-- Primary access patterns
CREATE INDEX idx_promotions_type ON promotions(type);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_activation_method ON promotions(activation_method);
CREATE INDEX idx_promotions_slug ON promotions(slug) WHERE slug IS NOT NULL;

-- Timestamp-based queries for scheduling and validity
CREATE INDEX idx_promotions_created_at ON promotions(created_at);
CREATE INDEX idx_promotions_updated_at ON promotions(updated_at);
CREATE INDEX idx_promotions_valid_from ON promotions(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_promotions_valid_to ON promotions(valid_to) WHERE valid_to IS NOT NULL;
CREATE INDEX idx_promotions_validity_range ON promotions(valid_from, valid_to) WHERE valid_from IS NOT NULL AND valid_to IS NOT NULL;

-- Priority and stacking queries
CREATE INDEX idx_promotions_priority ON promotions(priority);
CREATE INDEX idx_promotions_stackable ON promotions(stackable);
CREATE INDEX idx_promotions_priority_status ON promotions(priority, status);

-- Status-based queries
CREATE INDEX idx_promotions_active ON promotions(status) WHERE status = 'active';
CREATE INDEX idx_promotions_scheduled ON promotions(status) WHERE status = 'scheduled';
CREATE INDEX idx_promotions_draft ON promotions(status) WHERE status = 'draft';
CREATE INDEX idx_promotions_non_expired ON promotions(status) WHERE status != 'expired' AND status != 'archived';

-- Composite indexes for common business queries
CREATE INDEX idx_promotions_type_status ON promotions(type, status);
CREATE INDEX idx_promotions_activation_status ON promotions(activation_method, status);
CREATE INDEX idx_promotions_active_priority ON promotions(status, priority) WHERE status = 'active';
CREATE INDEX idx_promotions_code_based ON promotions(activation_method, status) WHERE activation_method = 'code';

-- Validity and scheduling composite indexes
CREATE INDEX idx_promotions_active_valid ON promotions(status, valid_from, valid_to) WHERE status = 'active';
CREATE INDEX idx_promotions_scheduled_start ON promotions(status, valid_from) WHERE status = 'scheduled' AND valid_from IS NOT NULL;

-- JSON field indexes for common queries (conceptual)
CREATE INDEX idx_promotions_campaign_id ON promotions(json_extract(external_references, '$.campaign')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_promotions_cms_id ON promotions(json_extract(external_references, '$.cms')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_promotions_analytics_id ON promotions(json_extract(external_references, '$.analytics')) WHERE external_references IS NOT NULL;
CREATE INDEX idx_promotions_single_code ON promotions(json_extract(codes, '$.single_code')) WHERE codes IS NOT NULL;
CREATE INDEX idx_promotions_total_uses ON promotions(json_extract(usage_limits, '$.total_uses')) WHERE usage_limits IS NOT NULL;
CREATE INDEX idx_promotions_uses_remaining ON promotions(json_extract(usage_limits, '$.uses_remaining')) WHERE usage_limits IS NOT NULL;

