
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
    'fulfilled',
    'shipped',
    'cancelled'
  )) DEFAULT 'incomplete',

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

