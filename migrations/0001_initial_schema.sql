-- MACH Alliance Open Data Model Compliant Database Schema
-- Mercora - First MACH Alliance Open Data Model Compliant Platform
-- Fixed version with proper table order and foreign key constraints

-- =====================================================
-- MACH Utility Objects (No Dependencies)
-- =====================================================

-- Address Table - Based on MACH Alliance Address specification
CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing', 'business', 'residential', 'mailing', 'pickup')),
    status TEXT DEFAULT 'unverified' CHECK (status IN ('active', 'invalid', 'undeliverable', 'verified', 'unverified')),
    line1 TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL CHECK (length(country) = 2),
    line2 TEXT,
    line3 TEXT,
    line4 TEXT,
    district TEXT,
    region TEXT,
    postal_code TEXT,
    coordinates TEXT,
    formatted TEXT,
    company TEXT,
    recipient TEXT,
    phone TEXT,
    email TEXT,
    delivery_instructions TEXT,
    access_codes TEXT,
    validation TEXT,
    attributes TEXT,
    created_at TEXT,
    updated_at TEXT,
    verified_at TEXT,
    extensions TEXT
);

CREATE INDEX idx_addresses_type ON addresses(type);
CREATE INDEX idx_addresses_status ON addresses(status);
CREATE INDEX idx_addresses_country ON addresses(country);
CREATE INDEX idx_addresses_region ON addresses(region);
CREATE INDEX idx_addresses_postal_code ON addresses(postal_code);
CREATE INDEX idx_addresses_recipient ON addresses(recipient);
CREATE INDEX idx_addresses_created_at ON addresses(created_at);

-- Language Table - Based on MACH Alliance Language specification
CREATE TABLE languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    locale TEXT NOT NULL UNIQUE,
    region TEXT,
    script TEXT,
    direction TEXT DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'experimental')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    formatting TEXT,
    fallback_locales TEXT,
    extensions TEXT
);

CREATE INDEX idx_languages_locale ON languages(locale);
CREATE INDEX idx_languages_code ON languages(code);
CREATE INDEX idx_languages_region ON languages(region) WHERE region IS NOT NULL;
CREATE INDEX idx_languages_status ON languages(status);
CREATE INDEX idx_languages_direction ON languages(direction);
CREATE INDEX idx_languages_script ON languages(script) WHERE script IS NOT NULL;
CREATE INDEX idx_languages_created ON languages(created_at);
CREATE INDEX idx_languages_updated ON languages(updated_at);

-- Media Table - Based on MACH Alliance Media specification
CREATE TABLE media (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video', 'document', 'audio', '3d')),
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'published', 'active', 'archived', 'deleted')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    title TEXT,
    description TEXT,
    tags TEXT,
    file TEXT NOT NULL,
    variants TEXT,
    thumbnail TEXT,
    focal_point TEXT,
    accessibility TEXT,
    metadata TEXT,
    extensions TEXT
);

CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_status ON media(status);
CREATE INDEX idx_media_type_status ON media(type, status);
CREATE INDEX idx_media_created_at ON media(created_at);
CREATE INDEX idx_media_updated_at ON media(updated_at);

-- =====================================================
-- MACH Identity Entities
-- =====================================================

-- Customer Table - Based on MACH Alliance Customer specification
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('person', 'company')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'archived', 'pending_verification')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    person TEXT,
    company TEXT,
    contacts TEXT,
    addresses TEXT,
    communication_preferences TEXT,
    segments TEXT,
    tags TEXT,
    loyalty TEXT,
    authentication TEXT,
    extensions TEXT
);

CREATE INDEX idx_customers_type ON customers(type);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_updated_at ON customers(updated_at);
CREATE INDEX idx_customers_type_status ON customers(type, status);

-- =====================================================
-- MACH Product Hierarchy (Dependencies: None → Categories → ProductTypes → Products → Variants)
-- =====================================================

-- Category Table - Based on MACH Alliance Category specification
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    parent_id TEXT,
    position INTEGER,
    path TEXT,
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    children TEXT,
    product_count INTEGER DEFAULT 0,
    attributes TEXT,
    tags TEXT,
    primary_image TEXT,
    media TEXT,
    seo TEXT,
    extensions TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE INDEX idx_categories_status ON categories(status);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_position ON categories(position);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_created_at ON categories(created_at);
CREATE INDEX idx_categories_hierarchy ON categories(parent_id, position);

-- ProductType Table - Based on MACH Alliance ProductType specification
CREATE TABLE product_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    attribute_definitions TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    description TEXT,
    parent_type_id TEXT,
    required_attributes TEXT,
    category_path TEXT,
    version TEXT,
    tags TEXT,
    applicable_channels TEXT,
    applicable_regions TEXT,
    extensions TEXT,
    FOREIGN KEY (parent_type_id) REFERENCES product_types(id)
);

CREATE INDEX idx_product_types_status ON product_types(status);
CREATE INDEX idx_product_types_parent_type_id ON product_types(parent_type_id) WHERE parent_type_id IS NOT NULL;
CREATE INDEX idx_product_types_version ON product_types(version) WHERE version IS NOT NULL;
CREATE INDEX idx_product_types_created_at ON product_types(created_at);
CREATE INDEX idx_product_types_updated_at ON product_types(updated_at);

-- Products Table - Based on MACH Alliance Product specification
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    description TEXT,
    slug TEXT,
    brand TEXT,
    categories TEXT,
    tags TEXT,
    options TEXT,
    default_variant_id TEXT,
    fulfillment_type TEXT DEFAULT 'physical' CHECK (fulfillment_type IN ('physical', 'digital', 'service')),
    tax_category TEXT,
    primary_image TEXT,
    media TEXT,
    seo TEXT,
    rating TEXT,
    related_products TEXT,
    extensions TEXT
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_type ON products(type) WHERE type IS NOT NULL;
CREATE INDEX idx_products_brand ON products(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_products_slug ON products(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_updated_at ON products(updated_at);
CREATE INDEX idx_products_fulfillment_type ON products(fulfillment_type);

-- Product Variants Table - Based on MACH Alliance ProductVariant specification
CREATE TABLE product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    option_values TEXT NOT NULL,
    price TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    position INTEGER,
    compare_at_price TEXT,
    cost TEXT,
    weight TEXT,
    dimensions TEXT,
    barcode TEXT,
    inventory TEXT,
    tax_category TEXT,
    shipping_required INTEGER DEFAULT 1 CHECK (shipping_required IN (0, 1)),
    media TEXT,
    attributes TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_status ON product_variants(status);
CREATE INDEX idx_product_variants_position ON product_variants(position) WHERE position IS NOT NULL;
CREATE INDEX idx_product_variants_product_status ON product_variants(product_id, status);

-- =====================================================
-- MACH Promotion System (Dependencies: None → Promotions → CouponInstances)
-- =====================================================

-- Promotions Table - Based on MACH Alliance Promotion specification
CREATE TABLE promotions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cart', 'product', 'shipping')),
    rules TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived')),
    description TEXT,
    slug TEXT,
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    valid_from TEXT,
    valid_to TEXT,
    activation_method TEXT DEFAULT 'automatic' CHECK (activation_method IN ('automatic', 'code', 'customer_specific', 'link')),
    codes TEXT,
    usage_limits TEXT,
    eligibility TEXT,
    priority INTEGER DEFAULT 100 CHECK (priority >= 0 AND priority <= 1000),
    stackable INTEGER DEFAULT 0 CHECK (stackable IN (0, 1)),
    extensions TEXT
);

CREATE INDEX idx_promotions_type ON promotions(type);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_activation_method ON promotions(activation_method);
CREATE INDEX idx_promotions_slug ON promotions(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_promotions_valid_from ON promotions(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_promotions_valid_to ON promotions(valid_to) WHERE valid_to IS NOT NULL;
CREATE INDEX idx_promotions_priority ON promotions(priority);

-- Coupon Instance Table - Based on MACH Alliance CouponInstance specification
CREATE TABLE coupon_instances (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    promotion_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'disabled', 'reserved')),
    type TEXT DEFAULT 'single_use' CHECK (type IN ('single_use', 'multi_use', 'unlimited')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    assigned_to TEXT,
    valid_from TEXT,
    valid_to TEXT,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    usage_limit INTEGER,
    last_used_at TEXT,
    last_used_by TEXT,
    generation_batch TEXT,
    extensions TEXT,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id)
);

CREATE INDEX idx_coupon_instances_code ON coupon_instances(code);
CREATE INDEX idx_coupon_instances_promotion_id ON coupon_instances(promotion_id);
CREATE INDEX idx_coupon_instances_status ON coupon_instances(status);
CREATE INDEX idx_coupon_instances_assigned_to ON coupon_instances(assigned_to);

-- =====================================================
-- MACH Commerce Dependencies (Dependencies: Products)
-- =====================================================

-- Inventory Table - Based on MACH Alliance Inventory specification
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    quantities TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
    stock_status TEXT CHECK (stock_status IN ('in_stock', 'out_of_stock', 'backorder', 'preorder')),
    external_references TEXT,
    created_at TEXT,
    updated_at TEXT,
    policy_id TEXT,
    backorderable INTEGER DEFAULT 0 CHECK (backorderable IN (0, 1)),
    backorder_eta TEXT,
    safety_stock INTEGER DEFAULT 0 CHECK (safety_stock >= 0),
    version INTEGER DEFAULT 0 CHECK (version >= 0),
    extensions TEXT
);

CREATE INDEX idx_inventory_sku_location ON inventory(sku_id, location_id);
CREATE INDEX idx_inventory_sku ON inventory(sku_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_stock_status ON inventory(stock_status);

-- Pricing Table - Based on MACH Alliance Pricing specification
CREATE TABLE pricing (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    list_price TEXT NOT NULL,
    sale_price TEXT NOT NULL,
    type TEXT DEFAULT 'retail' CHECK (type IN ('retail', 'wholesale', 'bulk', 'contract', 'dynamic')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'scheduled', 'expired', 'draft')),
    external_references TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    valid_from TEXT,
    valid_to TEXT,
    campaign_id TEXT,
    pricelist_id TEXT,
    catalog_id TEXT,
    tax TEXT,
    currency_code TEXT CHECK (length(currency_code) = 3),
    minimum_quantity INTEGER DEFAULT 1 CHECK (minimum_quantity >= 1),
    customer_segment_id TEXT,
    channel_id TEXT,
    region_id TEXT,
    extensions TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_pricing_product_id ON pricing(product_id);
CREATE INDEX idx_pricing_status ON pricing(status);
CREATE INDEX idx_pricing_type ON pricing(type);
CREATE INDEX idx_pricing_product_status ON pricing(product_id, status);
CREATE INDEX idx_pricing_valid_from ON pricing(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_pricing_valid_to ON pricing(valid_to) WHERE valid_to IS NOT NULL;

-- =====================================================
-- Non-MACH Extensions - Order Management
-- =====================================================

-- Orders Table - Custom extension (not defined by MACH Alliance)
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount TEXT NOT NULL, -- JSON: Money object
    currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
    shipping_address TEXT, -- JSON: Address object
    billing_address TEXT, -- JSON: Address object
    items TEXT NOT NULL, -- JSON: Array of order items
    shipping_method TEXT,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    shipped_at TEXT,
    delivered_at TEXT,
    tracking_number TEXT,
    external_references TEXT,
    extensions TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);



-- =====================================================
-- Application-Specific Extensions
-- =====================================================

-- API Tokens Table - For unified authentication system
CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_name TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    permissions TEXT NOT NULL, -- JSON array of permissions
    active INTEGER DEFAULT 1 CHECK (active IN (0, 1)),
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_tokens_token_name ON api_tokens(token_name);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_active ON api_tokens(active);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Chat Sessions Table - For AI agent conversations
CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    title TEXT,
    context TEXT, -- JSON: conversation context and metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_message_at TEXT,
    message_count INTEGER DEFAULT 0,
    extensions TEXT -- JSON: additional session data
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions(last_message_at);

-- Chat Messages Table - Individual messages in chat sessions
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    product_ids TEXT, -- JSON array of referenced product IDs
    metadata TEXT, -- JSON: message metadata (tokens, timing, etc.)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Order Webhooks Table - For order processing and notifications
CREATE TABLE order_webhooks (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    webhook_type TEXT NOT NULL CHECK (webhook_type IN ('order_created', 'order_updated', 'payment_completed', 'shipment_created', 'delivery_confirmed')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    payload TEXT NOT NULL, -- JSON: webhook payload
    response TEXT, -- JSON: webhook response
    endpoint_url TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_order_webhooks_order_id ON order_webhooks(order_id);
CREATE INDEX idx_order_webhooks_type ON order_webhooks(webhook_type);
CREATE INDEX idx_order_webhooks_status ON order_webhooks(status);
CREATE INDEX idx_order_webhooks_created_at ON order_webhooks(created_at);
CREATE INDEX idx_order_webhooks_next_retry ON order_webhooks(next_retry_at) WHERE next_retry_at IS NOT NULL;
