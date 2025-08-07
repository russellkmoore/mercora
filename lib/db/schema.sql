
-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  hero_image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Products
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL,
  long_description TEXT NOT NULL,
  primary_image_url TEXT,
  active BOOLEAN DEFAULT true,
  availability TEXT NOT NULL CHECK (availability IN ('available', 'coming_soon')),
  on_sale BOOLEAN DEFAULT false,
  ai_notes TEXT
);

-- Product Images
CREATE TABLE product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL
);

-- Product-Category Many-to-Many
CREATE TABLE product_categories (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);

-- Product Prices
CREATE TABLE product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD'
);

-- Product Sale Prices
CREATE TABLE product_sale_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD'
);

-- Product Inventory
CREATE TABLE product_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_use_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  use_case TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);


-- ORDERS --------------------------------------------------
CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,

  items TEXT NOT NULL,                 
  shipping_address TEXT NOT NULL,      
  billing_address TEXT,                
  shipping_option TEXT NOT NULL,       
  billing_info TEXT NOT NULL,         

  tax_amount REAL NOT NULL,
  shipping_cost REAL NOT NULL,
  total REAL NOT NULL,

  status TEXT NOT NULL CHECK (status IN (
    'incomplete',
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  )) DEFAULT 'incomplete',

  -- Shipping tracking fields
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  
  -- Additional metadata
  cancellation_reason TEXT,
  notes TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Webhook events table for tracking status updates and delivery confirmations
CREATE TABLE order_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'status_update',
    'tracking_update', 
    'delivery_confirmation',
    'exception'
  )),
  payload TEXT NOT NULL,                -- JSON webhook payload
  source TEXT NOT NULL,                 -- 'admin', 'carrier_webhook', 'system'
  processed BOOLEAN DEFAULT false,
  processed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(order_id, event_type, created_at)  -- Prevent duplicate events
);

-- API tokens table for unified authentication
CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_name TEXT NOT NULL UNIQUE,      -- 'admin_vectorize', 'admin_orders', 'webhook_carrier'
  token_hash TEXT NOT NULL,             -- SHA-256 hash of actual token
  permissions TEXT NOT NULL,            -- JSON array of permissions
  active BOOLEAN DEFAULT true,
  expires_at TEXT,                      -- Optional expiration
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

