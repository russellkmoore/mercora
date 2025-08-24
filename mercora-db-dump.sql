PRAGMA defer_foreign_keys=TRUE;
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
INSERT INTO "customers" VALUES('user_30ISTjcD9nHbIi9ydYXwMVsFPoq','person','active',NULL,'2025-08-24T06:03:47.110Z','2025-08-24T06:03:47.110Z','{"email":"russellkmoore@mac.com","first_name":"Russell","last_name":"Moore","full_name":"Russell Moore"}',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
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
INSERT INTO "categories" VALUES('cat_1','{"en": "Featured"}','{"en": "Our top recommended gear, handpicked for innovation, quality, and performance in the field."}','featured','active',NULL,1,'/featured',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["featured", "highlight", "bestseller", "top"]','{"url": "categories/featured.png", "alt_text": "Featured products"}',NULL,'{"meta_title": "Featured Products - Top Gear", "meta_description": "Our top recommended gear, handpicked for innovation, quality, and performance in the field."}','{}');
INSERT INTO "categories" VALUES('cat_2','{"en": "Sale"}','{"en": "Top-tier outdoor products at unbeatable prices—limited-time deals on must-have gear"}','sale','active',NULL,2,'/sale',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["sale", "discount", "promotion", "clearance", "deals"]','{"url": "categories/sale.png", "alt_text": "Sale products"}',NULL,'{"meta_title": "Sale - Discounted Outdoor Gear", "meta_description": "Top-tier outdoor products at unbeatable prices—limited-time deals on must-have gear"}','{}');
INSERT INTO "categories" VALUES('cat_3','{"en": "Camping"}','{"en": "Rugged and reliable equipment built for basecamps, wild trails, and everything in between."}','camping','active',NULL,3,'/camping',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["camping", "outdoor", "adventure", "basecamp", "trails"]','{"url": "categories/camping.png", "alt_text": "Camping gear"}',NULL,'{"meta_title": "Camping Gear - Outdoor Equipment", "meta_description": "Rugged and reliable equipment built for basecamps, wild trails, and everything in between."}','{}');
INSERT INTO "categories" VALUES('cat_4','{"en": "Apparel"}','{"en": "Functional, durable clothing and gear designed to adapt to harsh environments and shifting weather."}','apparel','active',NULL,4,'/apparel',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["apparel", "clothing", "gear", "weather", "functional"]','{"url": "categories/apparel.png", "alt_text": "Outdoor apparel"}',NULL,'{"meta_title": "Outdoor Apparel - Durable Clothing", "meta_description": "Functional, durable clothing and gear designed to adapt to harsh environments and shifting weather."}','{}');
INSERT INTO "categories" VALUES('cat_5','{"en": "Tools"}','{"en": "Precision instruments and multipurpose tools engineered for outdoor tasks and tactical readiness."}','tools','active',NULL,5,'/tools',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["tools", "tactical", "precision", "multipurpose", "instruments"]','{"url": "categories/tools.png", "alt_text": "Tactical tools"}',NULL,'{"meta_title": "Tactical Tools - Precision Instruments", "meta_description": "Precision instruments and multipurpose tools engineered for outdoor tasks and tactical readiness."}','{}');
INSERT INTO "categories" VALUES('cat_6','{"en": "Tech"}','{"en": "Advanced devices that enhance exploration—signal packs, field sensors, and performance-driven kits."}','tech','active',NULL,6,'/tech',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["tech", "technology", "devices", "sensors", "signal", "performance"]','{"url": "categories/tech.png", "alt_text": "Tech devices"}',NULL,'{"meta_title": "Tech Gear - Advanced Devices", "meta_description": "Advanced devices that enhance exploration—signal packs, field sensors, and performance-driven kits."}','{}');
INSERT INTO "categories" VALUES('cat_7','{"en": "Outdoor Utility"}','{"en": "Essential gear designed to support every outdoor mission—tools, kits, and devices built for rugged reliability and versatility."}','outdoor-utility','active',NULL,7,'/outdoor-utility',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["outdoor", "utility", "essential", "mission", "rugged", "versatile"]','{"url": "categories/utility.png", "alt_text": "Outdoor utility gear"}',NULL,'{"meta_title": "Outdoor Utility - Essential Mission Gear", "meta_description": "Essential gear designed to support every outdoor mission—tools, kits, and devices built for rugged reliability and versatility."}','{}');
INSERT INTO "categories" VALUES('cat_8','{"en": "Navigation"}','{"en": "Explore confidently with gear designed to help you orient, track, and discover your path forward."}','navigation','active',NULL,8,'/navigation',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37','[]',0,'{}','["navigation", "orient", "track", "explore", "path", "compass"]','{"url": "categories/navigation.png", "alt_text": "Navigation gear"}',NULL,'{"meta_title": "Navigation Gear - Exploration Tools", "meta_description": "Explore confidently with gear designed to help you orient, track, and discover your path forward."}','{}');
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
INSERT INTO "products" VALUES('prod_1','Vivid Mission Pack',NULL,'active','{"legacy_id": "1"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Vivid Mission Pack is engineered for agility and performance in demanding environments. Made from durable materials, it offers modular webbing for attachments, a rugged zip system, and a streamlined profile ideal for missions on the move."}','vivid-mission-pack','Mercora','["cat_1", "cat_2", "cat_3"]','["EDC", "compact", "military", "tactical"]','[{"id": "size", "name": "Size", "type": "select", "values": [{"id": "regular", "value": "Regular"}, {"id": "xl", "value": "XL"}]}]','variant_1','physical','standard','{"url": "products/vivid-mission-pack-0.png", "alt_text": "Vivid Mission Pack"}','[{"url": "products/vivid-mission-pack-0.png", "alt_text": "Vivid Mission Pack"}]','{"meta_title": "Vivid Mission Pack - Tactical Backpack", "meta_description": "Compact tactical pack designed for efficient gear organization and rapid deployment."}','{"average": 4.5, "count": 23}','["prod_4", "prod_10"]','{"ai_notes": "Ideal for minimalist loadouts and urban recon missions.", "use_cases": ["daily carry", "field ops", "travel"]}');
INSERT INTO "products" VALUES('prod_2','Dusty Fire Tool',NULL,'active','{"legacy_id": "2"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Dusty Fire Tool delivers reliable ignition even in wet and windy conditions. Its ergonomic grip, long-lasting ferrocerium rod, and integrated striker make it an essential tool for survivalists, campers, and adventurers."}','dusty-fire-tool','Mercora','["cat_1", "cat_2", "cat_5"]','["EDC", "firestarter", "survival"]',NULL,'variant_2','physical','standard','{"url": "products/dusty-fire-tool-1.png", "alt_text": "Dusty Fire Tool"}','[{"url": "products/dusty-fire-tool-1.png", "alt_text": "Dusty Fire Tool"}, {"url": "products/dusty-fire-tool-1a.png", "alt_text": "Dusty Fire Tool Detail"}, {"url": "products/dusty-fire-tool-1b.png", "alt_text": "Dusty Fire Tool Usage"}, {"url": "products/dusty-fire-tool-1c.png", "alt_text": "Dusty Fire Tool Kit"}]','{"meta_title": "Dusty Fire Tool - Ferro Rod Fire Starter", "meta_description": "Rugged ferro rod fire starter with high-grip handle for dependable sparks."}','{"average": 4.7, "count": 34}','["prod_12", "prod_30"]','{"ai_notes": "Perfect for backcountry expeditions and emergency preparedness kits.", "use_cases": ["camping", "survival", "emergency kits"]}');
INSERT INTO "products" VALUES('prod_3','Echo Sky Kit',NULL,'active','{"legacy_id": "3"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Echo Sky Kit is your lifeline in the wild. With NOAA weather alerts, FM/AM tuning, and a powerful built-in flashlight, it ensures communication and safety during backcountry treks, storms, or power outages. Comes with a rugged carabiner and durable antenna."}','echo-sky-kit','Mercora','["cat_1", "cat_2", "cat_5", "cat_8"]','["communication", "emergency", "radio"]',NULL,'variant_3','physical','standard','{"url": "products/echo-sky-kit-2.png", "alt_text": "Echo Sky Kit"}','[{"url": "products/echo-sky-kit-2.png", "alt_text": "Echo Sky Kit"}]','{"meta_title": "Echo Sky Kit - Emergency Radio & Communication", "meta_description": "Compact emergency radio and comms unit with built-in weather alerts."}','{"average": 4.6, "count": 19}','["prod_26", "prod_29"]','{"ai_notes": "Designed for off-grid communication and storm readiness. Compact and rugged enough to clip onto any pack.", "use_cases": ["storm prep", "off-grid living", "camping"]}');
INSERT INTO "products" VALUES('prod_4','Lunar Signal Pack',NULL,'active','{"legacy_id": "4"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Lunar Signal Pack is engineered for rapid deployment scenarios and long-range excursions. It includes modular compartments for tech gear, hydration, and communication tools, along with reinforced MOLLE webbing for accessory attachments. Built to endure lunar light or midnight missions."}','lunar-signal-pack','Mercora','["cat_1", "cat_3"]','["gear", "rugged", "tactical"]',NULL,'variant_4','physical','standard','{"url": "products/lunar-signal-pack-3.png", "alt_text": "Lunar Signal Pack"}','[{"url": "products/lunar-signal-pack-3.png", "alt_text": "Lunar Signal Pack"}]','{"meta_title": "Lunar Signal Pack - Advanced Tactical Backpack", "meta_description": "Advanced tactical backpack with comms-ready organization."}','{"average": 4.4, "count": 12}','["prod_1", "prod_23"]','{"ai_notes": "Developed for tactical operators and adventurers alike. Ideal for both urban carry and expedition use.", "use_cases": ["field operations", "signal kit storage", "outdoor missions"]}');
INSERT INTO "products" VALUES('prod_5','Twin Dune Tool',NULL,'active','{"legacy_id": "5"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "Designed for versatility in the harshest conditions, the Twin Dune Tool combines a dual wrench head with a prying edge and hex slot. Wrapped in durable paracord for added grip and emergency use, it''s ideal for quick field adjustments or breaking free from the unexpected."}','twin-dune-tool','Mercora','["cat_6", "cat_8"]','["compact", "durable", "multi-tool"]',NULL,'variant_5','physical','standard','{"url": "products/twin-dune-tool-4.png", "alt_text": "Twin Dune Tool"}','[{"url": "products/twin-dune-tool-4.png", "alt_text": "Twin Dune Tool"}]','{"meta_title": "Twin Dune Tool - Compact Dual-Head Wrench", "meta_description": "Compact dual-head survival wrench with tactical wrap."}','{"average": 4.3, "count": 28}','["prod_8", "prod_22"]','{"ai_notes": "Perfect for field engineers, survivalists, or minimalist gear kits. Its design is inspired by extreme desert conditions and lunar utility.", "use_cases": ["field repair", "emergency gear", "lightweight carry"]}');
INSERT INTO "products" VALUES('prod_6','Polar Leaf Device',NULL,'active','{"legacy_id": "6"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Polar Leaf Device is a rugged GPS navigation system built for zero-visibility terrain and remote operations. With tactile buttons, high-contrast display, and reinforced housing, it''s ideal for search and rescue teams, backcountry explorers, and off-grid adventurers."}','polar-leaf-device','Mercora','["cat_1", "cat_3"]','["GPS", "navigation", "rugged"]',NULL,'variant_6','physical','standard','{"url": "products/polar-leaf-device-5.png", "alt_text": "Polar Leaf Device"}','[{"url": "products/polar-leaf-device-5.png", "alt_text": "Polar Leaf Device"}]','{"meta_title": "Polar Leaf Device - Durable GPS Navigation", "meta_description": "Durable GPS navigation tool for extreme environments."}','{"average": 4.8, "count": 15}','["prod_29", "prod_26"]','{"ai_notes": "Tailored for survivalists and professionals navigating the wilderness. Cold-resistant with a rubberized shell for enhanced grip in arctic gear.", "use_cases": ["backcountry navigation", "emergency signaling", "expedition tracking"]}');
INSERT INTO "products" VALUES('prod_7','Rapid Wave Kit',NULL,'active','{"legacy_id": "7"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Rapid Wave Kit is a go-anywhere emergency essentials pouch featuring a rugged shell, internal compartments, and a quick-clip carabiner. Designed for first response and outdoor readiness, this kit is ideal for organizing quick-access tools, signaling gear, or hydration tablets."}','rapid-wave-kit','Mercora','["cat_1", "cat_4"]','["emergency", "pouch", "quick-access"]',NULL,'variant_7','physical','standard','{"url": "products/rapid-wave-kit-6.png", "alt_text": "Rapid Wave Kit"}','[{"url": "products/rapid-wave-kit-6.png", "alt_text": "Rapid Wave Kit"}]','{"meta_title": "Rapid Wave Kit - Emergency Communication Pouch", "meta_description": "Compact emergency communication and survival pouch."}','{"average": 4.2, "count": 31}','["prod_15", "prod_24"]','{"ai_notes": "Compact and versatile, the Rapid Wave Kit serves as a mobile command pouch for outdoor responders, campers, or utility belt configurations.", "use_cases": ["first aid storage", "outdoor readiness", "go-bag supplement"]}');
INSERT INTO "products" VALUES('prod_8','Eagle Shadow Tool',NULL,'active','{"legacy_id": "8"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Eagle Shadow Tool is engineered for stealth and function. Designed with a reinforced tanto-style blade, integrated bottle opener, and a carabiner clip for easy carry, this is the tool for adventurers, rescue operators, or EDC enthusiasts needing quick utility access in the field."}','eagle-shadow-tool','Mercora','["cat_5", "cat_6"]','["tanto", "EDC", "tactical"]',NULL,'variant_8','physical','standard','{"url": "products/eagle-shadow-tool-7.png", "alt_text": "Eagle Shadow Tool"}','[{"url": "products/eagle-shadow-tool-7.png", "alt_text": "Eagle Shadow Tool"}]','{"meta_title": "Eagle Shadow Tool - Tactical Multi-Tool", "meta_description": "A rugged multitool with a tactical blade and integrated clip."}','{"average": 4.6, "count": 27}','["prod_5", "prod_16"]','{"ai_notes": "Features a tanto blade for piercing strength and tactical design. Built-in carabiner enables easy access on bags or belts. Reliable for EDC or field utility.", "use_cases": ["everyday carry", "emergency access", "survival situations"]}');
INSERT INTO "products" VALUES('prod_9','Storm Orbit Device',NULL,'active','{"legacy_id": "9"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Storm Orbit Device is a rugged, wrist-mounted flashlight engineered for hands-free illumination in tactical and emergency scenarios. Featuring an ultra-bright LED core, water-resistant housing, and durable strap, it''s perfect for night operations, search and rescue, or utility work."}','storm-orbit-device','Mercora','["cat_3", "cat_7"]','["flashlight", "wrist-mounted", "tactical"]',NULL,'variant_9','physical','standard','{"url": "products/storm-orbit-device-8.png", "alt_text": "Storm Orbit Device"}','[{"url": "products/storm-orbit-device-8.png", "alt_text": "Storm Orbit Device"}]','{"meta_title": "Storm Orbit Device - Wrist-Mounted Flashlight", "meta_description": "A compact, wearable tactical flashlight with high-intensity output."}','{"average": 4.4, "count": 22}','["prod_17", "prod_21"]','{"ai_notes": "Compact wrist-mounted tactical light. Bright LED for high visibility. Ideal for emergency services, outdoor survival, or night patrol.", "use_cases": ["hands-free illumination", "emergency visibility", "tactical operations"]}');
INSERT INTO "products" VALUES('prod_10','Coastal Track Pack',NULL,'active','{"legacy_id": "10"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Coastal Track Pack combines tactical durability with modern utility. Its roll-top closure ensures protection from the elements, while the large capacity, side mesh pockets, and front MOLLE webbing provide versatile storage for outdoor gear, hydration, and quick-access tools."}','coastal-track-pack','Mercora','["cat_1"]','["roll-top", "waterproof", "tactical"]',NULL,'variant_10','physical','standard','{"url": "products/coastal-track-pack-9.png", "alt_text": "Coastal Track Pack"}','[{"url": "products/coastal-track-pack-9.png", "alt_text": "Coastal Track Pack"}]','{"meta_title": "Coastal Track Pack - Roll-Top Tactical Backpack", "meta_description": "A durable roll-top backpack designed for rugged coastal adventures."}','{"average": 4.5, "count": 18}','["prod_1", "prod_18"]','{"ai_notes": "Roll-top tactical backpack with MOLLE system. Suited for coastal hikes, tactical expeditions, and gear transport in wet conditions.", "use_cases": ["coastal hiking", "weatherproof storage", "multi-day carry"]}');
INSERT INTO "products" VALUES('prod_11','Noble Field Pack',NULL,'active','{"legacy_id": "11"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Noble Field Pack is a timeless design built for field versatility. Constructed with heavy-duty canvas and leather trim, it''s perfect for day hikes, urban exploring, or workday carry. Features include dual buckle straps, external pockets, and compression side straps for tailored storage."}','noble-field-pack','Mercora','["cat_4"]','["vintage", "canvas", "field", "utility"]',NULL,'variant_11','physical','standard','{"url": "products/noble-field-pack-10.png", "alt_text": "Noble Field Pack"}','[{"url": "products/noble-field-pack-10.png", "alt_text": "Noble Field Pack"}]','{"meta_title": "Noble Field Pack - Vintage Canvas Backpack", "meta_description": "A vintage-style canvas field pack for enduring utility and rugged style."}','{"average": 4.3, "count": 25}','["prod_14", "prod_18"]','{"ai_notes": "Classic brown field backpack with canvas exterior and buckle straps. Ideal for field work, university carry, or weekend hikes.", "use_cases": ["field work", "university carry", "day hiking"]}');
INSERT INTO "products" VALUES('prod_12','Nova Flame Device',NULL,'active','{"legacy_id": "12"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Nova Flame Device delivers powerful, windproof flame performance in any environment. Designed for tactical use, it features a safety lock, angled burner, and carabiner clip for secure attachment. Built with impact-resistant housing, it''s an essential fire tool for the wild."}','nova-flame-device','Mercora','["cat_5", "cat_6"]','["torch", "windproof", "tactical", "ignition"]',NULL,'variant_12','physical','standard','{"url": "products/nova-flame-device-11.png", "alt_text": "Nova Flame Device"}','[{"url": "products/nova-flame-device-11.png", "alt_text": "Nova Flame Device"}]','{"meta_title": "Nova Flame Device - Tactical Jet Torch", "meta_description": "A tactical jet flame torch for rugged field ignition."}','{"average": 4.6, "count": 32}','["prod_2", "prod_30"]','{"ai_notes": "Compact black torch with angled flame nozzle and red accent. Ideal for outdoor ignition in wind or rain.", "use_cases": ["fire starting", "welding", "tactical operations"]}');
INSERT INTO "products" VALUES('prod_13','Solar Arc Tool',NULL,'active','{"legacy_id": "13"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Solar Arc Tool provides reliable ignition using solar energy and an internal rechargeable arc system. Designed for off-grid readiness, it features a solar panel, arc ignition button, and durable weather-resistant body. Ideal for sustainable field operations and emergency kits."}','solar-arc-tool','Mercora','["cat_5", "cat_6"]','["solar", "arc", "sustainable", "ignition"]',NULL,'variant_13','physical','standard','{"url": "products/solar-arc-tool-12.png", "alt_text": "Solar Arc Tool"}','[{"url": "products/solar-arc-tool-12.png", "alt_text": "Solar Arc Tool"}]','{"meta_title": "Solar Arc Tool - Solar Ignition Device", "meta_description": "A rugged solar-powered arc ignition device."}','{"average": 4.4, "count": 18}','["prod_12", "prod_25"]','{"ai_notes": "Compact black ignition device with solar panel and orange button. Built for off-grid utility and renewable energy use.", "use_cases": ["off-grid living", "emergency preparedness", "solar camping"]}');
INSERT INTO "products" VALUES('prod_14','Shadow Trail Pack',NULL,'active','{"legacy_id": "14"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Shadow Trail Pack is designed for minimal visibility and maximum functionality on rugged trails. Featuring a dark tactical finish, multi-compartment design, secure flap buckle, and side utility pockets, it''s built for serious explorers and urban operators alike."}','shadow-trail-pack','Mercora','["cat_3", "cat_4"]','["stealth", "tactical", "trail", "rugged"]',NULL,'variant_14','physical','standard','{"url": "products/shadow-trail-pack-13.png", "alt_text": "Shadow Trail Pack"}','[{"url": "products/shadow-trail-pack-13.png", "alt_text": "Shadow Trail Pack"}]','{"meta_title": "Shadow Trail Pack - Stealth Tactical Backpack", "meta_description": "A stealthy and durable backpack for rugged trails."}','{"average": 4.5, "count": 21}','["prod_11", "prod_23"]','{"ai_notes": "Matte black tactical backpack with buckle closure, side pockets, and reinforced build for trail and stealth use.", "use_cases": ["stealth missions", "trail navigation", "low-profile carry"]}');
INSERT INTO "products" VALUES('prod_15','Wild Harbor Kit',NULL,'active','{"legacy_id": "15"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Wild Harbor Kit is a rugged, minimalist pouch designed for portability and utility. Ideal for field medics, travelers, or tacticians, this durable kit features dual-zippered compartments, reinforced stitching, and modular attachment loops for a streamlined experience in any environment."}','wild-harbor-kit','Mercora','["cat_5"]','["pouch", "utility", "modular", "field"]',NULL,'variant_15','physical','standard','{"url": "products/wild-harbor-kit-14.png", "alt_text": "Wild Harbor Kit"}','[{"url": "products/wild-harbor-kit-14.png", "alt_text": "Wild Harbor Kit"}]','{"meta_title": "Wild Harbor Kit - Tactical Utility Pouch", "meta_description": "Compact all-purpose pouch for remote operations."}','{"average": 4.2, "count": 29}','["prod_7", "prod_24"]','{"ai_notes": "Compact tactical pouch with dual-zipper compartments, rugged handle, and modular loops for tool or medical storage.", "use_cases": ["field medic", "tool organization", "tactical ops"]}');
INSERT INTO "products" VALUES('prod_16','Iron Echo Tool',NULL,'active','{"legacy_id": "16"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Iron Echo Tool is a reinforced tactical impact device, combining brute strength with ergonomic design. Featuring a precision-milled tip for breaking barriers, a carabiner loop for rapid access, and skeletonized panels for reduced weight, this tool is trusted by operators in critical breaching or rescue operations."}','iron-echo-tool','Mercora','["cat_8"]','["impact", "tactical", "breaching", "rescue"]',NULL,'variant_16','physical','standard','{"url": "products/iron-echo-tool-15.png", "alt_text": "Iron Echo Tool"}','[{"url": "products/iron-echo-tool-15.png", "alt_text": "Iron Echo Tool"}]','{"meta_title": "Iron Echo Tool - Tactical Impact Tool", "meta_description": "Heavy-duty tactical tool for extreme impact applications."}','{"average": 4.7, "count": 16}','["prod_5", "prod_22"]','{"ai_notes": "Impact breaching tool with a pointed hardened tip, skeletonized grip for lightweight handling, and tactical clip and loop for secure carry.", "use_cases": ["breaching", "rescue operations", "emergency access"]}');
INSERT INTO "products" VALUES('prod_17','Prism Blaze Device',NULL,'active','{"legacy_id": "17"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Prism Blaze Device is a high-lumen tactical flashlight engineered for maximum durability and visibility in critical operations. Its dual-tone rugged casing ensures secure grip, while the focused reflector cone provides concentrated beam intensity ideal for search, signaling, or field navigation."}','prism-blaze-device','Mercora','["cat_1"]','["flashlight", "tactical", "high-lumen", "search"]',NULL,'variant_17','physical','standard','{"url": "products/prism-blaze-device-16.png", "alt_text": "Prism Blaze Device"}','[{"url": "products/prism-blaze-device-16.png", "alt_text": "Prism Blaze Device"}]','{"meta_title": "Prism Blaze Device - High-Intensity Tactical Flashlight", "meta_description": "High-intensity tactical flashlight with rugged design."}','{"average": 4.8, "count": 24}','["prod_9", "prod_21"]','{"ai_notes": "Features high-powered LED with focused optics, shockproof body, and molded grip zones. Excellent for tactical, outdoor, and emergency use.", "use_cases": ["search and rescue", "tactical operations", "night navigation"]}');
INSERT INTO "products" VALUES('prod_18','Crimson Path Pack',NULL,'active','{"legacy_id": "18"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Crimson Path Pack combines robust utility with bold aesthetics, featuring reinforced straps, MOLLE webbing, and expansive compartmental design. Ideal for adventurous commuters or trailblazers seeking a standout look with serious function."}','crimson-path-pack','Mercora','["cat_3", "cat_4"]','["bold", "adventure", "MOLLE", "commuter"]',NULL,'variant_18','physical','standard','{"url": "products/crimson-path-pack-17.png", "alt_text": "Crimson Path Pack"}','[{"url": "products/crimson-path-pack-17.png", "alt_text": "Crimson Path Pack"}]','{"meta_title": "Crimson Path Pack - Adventure Tactical Backpack", "meta_description": "Bold and rugged backpack for trail and travel."}','{"average": 4.4, "count": 20}','["prod_10", "prod_27"]','{"ai_notes": "Equipped with adjustable sternum strap, mesh side pockets, and weather-resistant fabric. Ideal for daily carry, trekking, and outdoor missions.", "use_cases": ["adventure travel", "daily commuting", "outdoor missions"]}');
INSERT INTO "products" VALUES('prod_19','Arctic Pulse Tool',NULL,'active','{"legacy_id": "19"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "Engineered for extreme environments, the Arctic Pulse Tool features an integrated pulse sensor, high-visibility readout, and a protective outer casing built to withstand the elements. Its durable construction and carabiner-ready design make it perfect for high-altitude and cold-weather expeditions."}','arctic-pulse-tool','Mercora','["cat_6"]','["pulse", "sensor", "arctic", "extreme"]',NULL,'variant_19','physical','standard','{"url": "products/arctic-pulse-tool-18.png", "alt_text": "Arctic Pulse Tool"}','[{"url": "products/arctic-pulse-tool-18.png", "alt_text": "Arctic Pulse Tool"}]','{"meta_title": "Arctic Pulse Tool - Precision Pulse Monitor", "meta_description": "Precision pulse monitor in rugged arctic-grade housing."}','{"average": 4.6, "count": 14}','["prod_6", "prod_25"]','{"ai_notes": "Displays real-time pulse waveform; ideal for emergency response kits, mountaineering teams, or scientific expeditions in cold climates.", "use_cases": ["mountaineering", "emergency response", "scientific expeditions"]}');
INSERT INTO "products" VALUES('prod_20','Zenith Rock Kit',NULL,'active','{"legacy_id": "20"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "Designed for rockhounds and geologists alike, the Zenith Rock Kit is a compact, rugged field pack ideal for carrying tools, samples, and essentials. Reinforced with MOLLE webbing and padded compartments, it is built to support rough terrain and long excursions."}','zenith-rock-kit','Mercora','["cat_3", "cat_4", "cat_7"]','["geology", "sampling", "fieldwork", "research"]',NULL,'variant_20','physical','standard','{"url": "products/zenith-rock-kit-19.png", "alt_text": "Zenith Rock Kit"}','[{"url": "products/zenith-rock-kit-19.png", "alt_text": "Zenith Rock Kit"}]','{"meta_title": "Zenith Rock Kit - Geological Field Pack", "meta_description": "Durable geological sampling pack for fieldwork and discovery."}','{"average": 4.3, "count": 17}','["prod_15", "prod_24"]','{"ai_notes": "Perfect for geological exploration, fossil collection, and rugged outdoor research expeditions. Highly portable and weather-resistant.", "use_cases": ["geological surveys", "rock collecting", "scientific field work"]}');
INSERT INTO "products" VALUES('prod_21','Stealth Brook Device',NULL,'active','{"legacy_id": "21"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Stealth Brook Device is a lightweight, pocket-sized tactical flashlight built for covert operations and nighttime navigation. Featuring textured grip zones, a recessed power switch, and a rugged clip, it provides reliability and discretion in low-light environments."}','stealth-brook-device','Mercora','["cat_5", "cat_6", "cat_8"]','["stealth", "compact", "tactical", "navigation"]',NULL,'variant_21','physical','standard','{"url": "products/stealth-brook-device-20.png", "alt_text": "Stealth Brook Device"}','[{"url": "products/stealth-brook-device-20.png", "alt_text": "Stealth Brook Device"}]','{"meta_title": "Stealth Brook Device - Compact Tactical Flashlight", "meta_description": "Compact tactical flashlight for stealth and utility."}','{"average": 4.5, "count": 22}','["prod_17", "prod_9"]','{"ai_notes": "Ideal for camping, night treks, or emergency use. Compact yet powerful with easy-to-access controls and durable all-weather construction.", "use_cases": ["covert operations", "night navigation", "emergency lighting"]}');
INSERT INTO "products" VALUES('prod_22','Comet Trace Tool',NULL,'active','{"legacy_id": "22"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Comet Trace Tool is a robust, compact utility tool housed in a protective tactical sheath. Crafted from high-strength alloy, it includes multiple integrated functions such as a hex wrench, pry edge, and screw bit interface, making it ideal for field adjustments and gear maintenance."}','comet-trace-tool','Mercora','["cat_5"]','["utility", "multitool", "maintenance", "compact"]',NULL,'variant_22','physical','standard','{"url": "products/comet-trace-tool-21.png", "alt_text": "Comet Trace Tool"}','[{"url": "products/comet-trace-tool-21.png", "alt_text": "Comet Trace Tool"}]','{"meta_title": "Comet Trace Tool - Compact Utility Tool", "meta_description": "Multifunctional compact tool with durable sheath."}','{"average": 4.4, "count": 26}','["prod_5", "prod_16"]','{"ai_notes": "Excellent for field repairs, everyday carry, or survival kits. Sleek and tactical, it includes a MOLLE-compatible sheath and corrosion-resistant finish.", "use_cases": ["field maintenance", "gear repair", "everyday carry"]}');
INSERT INTO "products" VALUES('prod_23','Onyx Surge Pack',NULL,'active','{"legacy_id": "23"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Onyx Surge Pack is engineered for durability and capacity, perfect for fast-response missions or heavy-duty daily use. Built with rugged nylon, internal organization, hydration compatibility, and MOLLE webbing throughout, this pack supports high-performance demands in stealth and style."}','onyx-surge-pack','Mercora','["cat_3", "cat_4"]','["stealth", "tactical", "capacity", "MOLLE"]',NULL,'variant_23','physical','standard','{"url": "products/onyx-surge-pack-22.png", "alt_text": "Onyx Surge Pack"}','[{"url": "products/onyx-surge-pack-22.png", "alt_text": "Onyx Surge Pack"}]','{"meta_title": "Onyx Surge Pack - Stealth Tactical Backpack", "meta_description": "Stealth-ready tactical backpack for dynamic loads."}','{"average": 4.6, "count": 19}','["prod_4", "prod_14"]','{"ai_notes": "Ideal for tactical operators, outdoor missions, or urban carry. Equipped with compression straps, reinforced stitching, and padded support to carry heavy loads comfortably.", "use_cases": ["tactical missions", "heavy-duty carry", "urban operations"]}');
INSERT INTO "products" VALUES('prod_24','Bright Echo Kit',NULL,'active','{"legacy_id": "24"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Bright Echo Kit offers utility in a small form—perfect for tactical medics, quick-access gear, or field tech tools. Durable canvas with reinforced loops and MOLLE-compatible design ensure seamless integration with packs or belts."}','bright-echo-kit','Mercora','["cat_3", "cat_4", "cat_7"]','["medical", "utility", "MOLLE", "compact"]',NULL,'variant_24','physical','standard','{"url": "products/bright-echo-kit-23.png", "alt_text": "Bright Echo Kit"}','[{"url": "products/bright-echo-kit-23.png", "alt_text": "Bright Echo Kit"}]','{"meta_title": "Bright Echo Kit - Tactical Utility Pouch", "meta_description": "Compact field pouch for fast-access essentials."}','{"average": 4.1, "count": 31}','["prod_7", "prod_15"]','{"ai_notes": "Great for on-the-go operations, first aid, or communication gear. Includes quick-release buckle, interior compartments, and weather-resistant build.", "use_cases": ["tactical medical", "field communications", "quick access tools"]}');
INSERT INTO "products" VALUES('prod_25','Frost Hollow Device',NULL,'active','{"legacy_id": "25"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Frost Hollow Device is engineered for extreme environments. With ruggedized housing, a thermal-safe grip, and insulated electronics, it''s perfect for signaling, location tracking, or activating cold-weather gear. Designed to survive the frostiest expeditions."}','frost-hollow-device','Mercora','["cat_3", "cat_6", "cat_8"]','["cold-weather", "survival", "beacon", "tracking"]',NULL,'variant_25','physical','standard','{"url": "products/frost-hollow-device-24.png", "alt_text": "Frost Hollow Device"}','[{"url": "products/frost-hollow-device-24.png", "alt_text": "Frost Hollow Device"}]','{"meta_title": "Frost Hollow Device - Cold-Weather Survival Beacon", "meta_description": "Cold-weather survival beacon and tracker."}','{"average": 4.4, "count": 13}','["prod_6", "prod_19"]','{"ai_notes": "Built to withstand sub-zero conditions. Features a high-grip texture, compact body, lanyard loop, and oversized knob for use with gloves.", "use_cases": ["arctic expeditions", "emergency signaling", "cold weather survival"]}');
INSERT INTO "products" VALUES('prod_26','Signal Glade Tool',NULL,'active','{"legacy_id": "26"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Signal Glade Tool is a rugged, palm-sized unit for communication, beaconing, and emergency data relay. Designed with a bright display and textured grips, this device fits field teams needing connectivity and signal clarity in wilderness or off-grid zones."}','signal-glade-tool','Mercora','["cat_3"]','["communication", "beacon", "data", "off-grid"]',NULL,'variant_26','physical','standard','{"url": "products/signal-glade-tool-25.png", "alt_text": "Signal Glade Tool"}','[{"url": "products/signal-glade-tool-25.png", "alt_text": "Signal Glade Tool"}]','{"meta_title": "Signal Glade Tool - Communication Interface", "meta_description": "Compact comms and navigation interface."}','{"average": 4.5, "count": 16}','["prod_3", "prod_29"]','{"ai_notes": "Wide signal support in compact form factor. Features a shock-resistant screen frame, reinforced rubber grip zones, tactical green shell, and a bright orange cord for visibility.", "use_cases": ["field communications", "emergency beacon", "off-grid connectivity"]}');
INSERT INTO "products" VALUES('prod_27','Ember Crest Pack',NULL,'active','{"legacy_id": "27"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Ember Crest Pack features a dual-tone design with a sharp ember-colored panel accenting the front, secured with front buckles and dual side straps. Designed for adventure with tactical styling, it''s ideal for those who want a sturdy carry with flair."}','ember-crest-pack','Mercora','["cat_3", "cat_4"]','["adventure", "dual-tone", "tactical", "flair"]',NULL,'variant_27','physical','standard','{"url": "products/ember-crest-pack-26.png", "alt_text": "Ember Crest Pack"}','[{"url": "products/ember-crest-pack-26.png", "alt_text": "Ember Crest Pack"}]','{"meta_title": "Ember Crest Pack - Adventure Field Pack", "meta_description": "Bold field pack for elevated excursions."}','{"average": 4.3, "count": 22}','["prod_18", "prod_11"]','{"ai_notes": "Black rugged pack with ember red geometric front panel. Features buckle flap closure, outer zip pocket, adjustable compression straps, and reinforced shoulder harness for extended wear.", "use_cases": ["adventure travel", "tactical style carry", "elevated excursions"]}');
INSERT INTO "products" VALUES('prod_28','Sunbeam Range Kit',NULL,'active','{"legacy_id": "28"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Sunbeam Range Kit is a standout utility pouch with a rugged mustard-colored canvas exterior. Featuring a front zipper pocket and durable buckle side straps, this kit is perfect for carrying essential gear in style."}','sunbeam-range-kit','Mercora','["cat_4", "cat_7"]','["utility", "mustard", "canvas", "style"]',NULL,'variant_28','physical','standard','{"url": "products/sunbeam-range-kit-27.png", "alt_text": "Sunbeam Range Kit"}','[{"url": "products/sunbeam-range-kit-27.png", "alt_text": "Sunbeam Range Kit"}]','{"meta_title": "Sunbeam Range Kit - Compact Utility Pouch", "meta_description": "Compact carry pouch in bright mustard yellow."}','{"average": 4.2, "count": 28}','["prod_24", "prod_15"]','{"ai_notes": "Mustard yellow compact kit with a top carry handle, black front zipper, and dark olive side buckle straps. Clean stitched patch label adds a refined touch. Ideal for organizing essentials.", "use_cases": ["range activities", "gear organization", "stylish carry"]}');
INSERT INTO "products" VALUES('prod_29','Quantum Ash Device',NULL,'active','{"legacy_id": "29"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Quantum Ash Device is a tactical digital compass encased in a rugged, charcoal-toned exterior. Equipped with tactile arrow keys and an \"OK\" selection button, it''s built for precision and durability in outdoor conditions."}','quantum-ash-device','Mercora','["cat_6", "cat_8"]','["compass", "tactical", "digital", "navigation"]',NULL,'variant_29','physical','standard','{"url": "products/quantum-ash-device-28.png", "alt_text": "Quantum Ash Device"}','[{"url": "products/quantum-ash-device-28.png", "alt_text": "Quantum Ash Device"}]','{"meta_title": "Quantum Ash Device - Digital Tactical Compass", "meta_description": "Compact navigation device with rugged black casing."}','{"average": 4.7, "count": 15}','["prod_6", "prod_26"]','{"ai_notes": "Charcoal black nav-device with analog-style digital compass interface. Features rubberized side grips, top antenna, durable directional buttons, and lanyard loop. Built for field utility.", "use_cases": ["tactical navigation", "precision compass work", "field operations"]}');
INSERT INTO "products" VALUES('prod_30','Volcanic Ridge Tool',NULL,'active','{"legacy_id": "30"}','2025-08-23 16:15:37','2025-08-23 16:15:37','{"en": "The Volcanic Ridge Tool is a compact, fire-inspired utility tool featuring a glowing flame motif. Designed for durability and performance, it sports a reinforced black body with textured grips, a knurled adjustment knob, and integrated carabiner loop."}','volcanic-ridge-tool','Mercora','["cat_5"]','["fire", "utility", "flame", "compact"]',NULL,'variant_30','physical','standard','{"url": "products/volcanic-ridge-tool-29.png", "alt_text": "Volcanic Ridge Tool"}','[{"url": "products/volcanic-ridge-tool-29.png", "alt_text": "Volcanic Ridge Tool"}]','{"meta_title": "Volcanic Ridge Tool - Fire-Themed Utility Tool", "meta_description": "Fire-themed utility tool with rugged grip and glowing flame tip."}','{"average": 4.5, "count": 20}','["prod_2", "prod_12"]','{"ai_notes": "Compact fire-themed tool with black rugged polymer casing. Features illuminated flame tip, knurled side dial, integrated carabiner, and bright orange label. Ideal for emergency signal or survival applications.", "use_cases": ["emergency signaling", "survival applications", "fire-themed utility"]}');
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
INSERT INTO "product_variants" VALUES('variant_1','prod_1','VMP-001','[{"option_id": "size", "value": "Regular"}]','{"amount": 7999, "currency": "USD"}','active',1,'{"amount": 7999, "currency": "USD"}','{"amount": 4000, "currency": "USD"}','{"value": 2.5, "unit": "lbs"}','{"length": 18, "width": 12, "height": 8, "unit": "inches"}','VMP001BAR','{"quantity": 50, "status": "in_stock"}','standard',1,'[]','{"capacity": "10L", "color": "Olive Drab", "material": "Cordura nylon", "size": "Regular"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_2','prod_2','DFT-001','[]','2499','active',1,'2499','1200','{"value": 0.3, "unit": "lbs"}','{"length": 5, "width": 1, "height": 0.5, "unit": "inches"}','DFT001BAR','150','standard',1,'[]','{"color": "Charcoal Black", "length": "5 inches", "material": "ferrocerium & polymer grip"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_3','prod_3','ESK-001','[]','4999','active',1,'4999','2500','{"value": 1.2, "unit": "lbs"}','{"length": 6, "width": 4, "height": 2.5, "unit": "inches"}','ESK001BAR','75','standard',1,'[]','{"bands": "AM/FM/NOAA", "battery": "Rechargeable lithium-ion", "color": "Tactical Black"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_4','prod_4','LSP-001','[]','7999','active',1,'7999','4000','{"value": 3.2, "unit": "lbs"}','{"length": 20, "width": 14, "height": 9, "unit": "inches"}','LSP001BAR','60','standard',1,'[]','{"capacity": "28L", "color": "Carbon Black", "material": "Ballistic Nylon"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_5','prod_5','TDT-001','[]','3499','active',1,'3499','1700','{"value": 0.4, "unit": "lbs"}','{"length": 5.5, "width": 1.5, "height": 0.8, "unit": "inches"}','TDT001BAR','90','standard',1,'[]','{"grip": "Paracord wrapped", "length": "5.5 in", "material": "Anodized Steel"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_6','prod_6','PLD-001','[]','12999','active',1,'12999','6500','{"value": 0.8, "unit": "lbs"}','{"length": 4, "width": 2.5, "height": 1.5, "unit": "inches"}','PLD001BAR','60','standard',1,'[]','{"type": "GPS Navigation", "display": "High-contrast LCD", "housing": "Reinforced tactical"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_7','prod_7','RWK-001','[]','4499','active',1,'4499','2200','{"value": 0.6, "unit": "lbs"}','{"length": 8, "width": 5, "height": 2, "unit": "inches"}','RWK001BAR','80','standard',1,'[]','{"type": "Emergency Kit", "compartments": "Multiple", "attachment": "Carabiner clip"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_8','prod_8','EST-001','[]','5999','active',1,'5999','3000','{"value": 0.5, "unit": "lbs"}','{"length": 4, "width": 1, "height": 0.5, "unit": "inches"}','EST001BAR','120','standard',1,'[]','{"blade": "Tanto-style", "features": "Bottle opener, carabiner", "material": "Tactical steel"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_9','prod_9','SOD-001','[]','4499','active',1,'4499','2200','{"value": 0.3, "unit": "lbs"}','{"length": 3, "width": 2, "height": 1.5, "unit": "inches"}','SOD001BAR','140','standard',1,'[]','{"type": "Wrist flashlight", "LED": "Ultra-bright", "housing": "Water-resistant"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_10','prod_10','CTP-001','[]','7499','active',1,'7499','3700','{"value": 2.8, "unit": "lbs"}','{"length": 19, "width": 13, "height": 7, "unit": "inches"}','CTP001BAR','110','standard',1,'[]','{"closure": "Roll-top", "webbing": "MOLLE compatible", "capacity": "35L"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_11','prod_11','NFP-001','[]','6899','active',1,'6899','3400','{"value": 2.2, "unit": "lbs"}','{"length": 17, "width": 11, "height": 6, "unit": "inches"}','NFP001BAR','95','standard',1,'[]','{"material": "Heavy-duty canvas", "trim": "Leather", "closure": "Dual buckle"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_12','prod_12','NFD-001','[]','4499','active',1,'4499','2200','{"value": 0.4, "unit": "lbs"}','{"length": 4, "width": 1.5, "height": 1, "unit": "inches"}','NFD001BAR','140','standard',1,'[]','{"type": "Jet flame torch", "features": "Safety lock, angled burner, carabiner", "housing": "Impact-resistant"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_13','prod_13','SAT-001','[]','4999','active',1,'4999','2500','{"value": 0.5, "unit": "lbs"}','{"length": 4.5, "width": 2, "height": 0.8, "unit": "inches"}','SAT001BAR','120','standard',1,'[]','{"power": "Solar panel", "ignition": "Arc system", "housing": "Weather-resistant"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_14','prod_14','STP-001','[]','7499','active',1,'7499','3700','{"value": 2.6, "unit": "lbs"}','{"length": 18, "width": 12, "height": 7, "unit": "inches"}','STP001BAR','80','standard',1,'[]','{"finish": "Dark tactical", "closure": "Secure flap buckle", "pockets": "Side utility"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_15','prod_15','WHK-001','[]','3499','active',1,'3499','1700','{"value": 0.8, "unit": "lbs"}','{"length": 9, "width": 6, "height": 3, "unit": "inches"}','WHK001BAR','100','standard',1,'[]','{"compartments": "Dual-zippered", "attachment": "Modular loops", "construction": "Reinforced stitching"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_16','prod_16','IET-001','[]','4299','active',1,'4299','2100','{"value": 0.7, "unit": "lbs"}','{"length": 6, "width": 1.5, "height": 0.8, "unit": "inches"}','IET001BAR','75','standard',1,'[]','{"tip": "Precision-milled", "design": "Skeletonized panels", "attachment": "Carabiner loop"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_17','prod_17','PBD-001','[]','3699','active',1,'3699','1800','{"value": 0.6, "unit": "lbs"}','{"length": 6, "width": 1.5, "height": 1.5, "unit": "inches"}','PBD001BAR','120','standard',1,'[]','{"LED": "High-lumen", "casing": "Dual-tone rugged", "reflector": "Focused cone"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_18','prod_18','CPP-001','[]','5899','active',1,'5899','2900','{"value": 2.4, "unit": "lbs"}','{"length": 18, "width": 11, "height": 7, "unit": "inches"}','CPP001BAR','90','standard',1,'[]','{"webbing": "MOLLE", "straps": "Reinforced", "design": "Expansive compartmental"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_19','prod_19','APT-001','[]','6399','active',1,'6399','3200','{"value": 0.9, "unit": "lbs"}','{"length": 5, "width": 3, "height": 1.5, "unit": "inches"}','APT001BAR','60','standard',1,'[]','{"sensor": "Integrated pulse", "display": "High-visibility", "casing": "Arctic-grade"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_20','prod_20','ZRK-001','[]','5499','active',1,'5499','2700','{"value": 1.8, "unit": "lbs"}','{"length": 12, "width": 8, "height": 5, "unit": "inches"}','ZRK001BAR','75','standard',1,'[]','{"webbing": "MOLLE", "compartments": "Padded", "purpose": "Geological sampling"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_21','prod_21','SBD-001','[]','4299','active',1,'4299','2100','{"value": 0.2, "unit": "lbs"}','{"length": 4, "width": 1, "height": 0.8, "unit": "inches"}','SBD001BAR','100','standard',1,'[]','{"size": "Pocket-sized", "switch": "Recessed power", "grip": "Textured zones"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_22','prod_22','CTT-001','[]','3899','active',1,'3899','1900','{"value": 0.5, "unit": "lbs"}','{"length": 5, "width": 1.2, "height": 0.6, "unit": "inches"}','CTT001BAR','100','standard',1,'[]','{"alloy": "High-strength", "functions": "Hex wrench, pry edge, screw bit", "sheath": "Tactical"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_23','prod_23','OSP-001','[]','6599','active',1,'6599','3300','{"value": 3.1, "unit": "lbs"}','{"length": 20, "width": 13, "height": 8, "unit": "inches"}','OSP001BAR','100','standard',1,'[]','{"material": "Rugged nylon", "webbing": "MOLLE throughout", "compatibility": "Hydration"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_24','prod_24','BEK-001','[]','3499','active',1,'3499','1700','{"value": 0.7, "unit": "lbs"}','{"length": 8, "width": 5, "height": 2.5, "unit": "inches"}','BEK001BAR','100','standard',1,'[]','{"material": "Durable canvas", "loops": "Reinforced", "design": "MOLLE-compatible"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_25','prod_25','FHD-001','[]','4199','active',1,'4199','2100','{"value": 0.6, "unit": "lbs"}','{"length": 4.5, "width": 2.5, "height": 1.2, "unit": "inches"}','FHD001BAR','85','standard',1,'[]','{"housing": "Ruggedized", "grip": "Thermal-safe", "electronics": "Insulated"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_26','prod_26','SGT-001','[]','4599','active',1,'4599','2300','{"value": 0.4, "unit": "lbs"}','{"length": 4, "width": 2, "height": 1, "unit": "inches"}','SGT001BAR','90','standard',1,'[]','{"display": "Bright", "grips": "Textured", "size": "Palm-sized"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_27','prod_27','ECP-001','[]','5499','active',1,'5499','2700','{"value": 2.3, "unit": "lbs"}','{"length": 17, "width": 12, "height": 6.5, "unit": "inches"}','ECP001BAR','85','standard',1,'[]','{"design": "Dual-tone", "panel": "Ember-colored", "closure": "Front buckles"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_28','prod_28','SRK-001','[]','3299','active',1,'3299','1600','{"value": 0.6, "unit": "lbs"}','{"length": 9, "width": 6, "height": 3, "unit": "inches"}','SRK001BAR','115','standard',1,'[]','{"exterior": "Mustard canvas", "pocket": "Front zipper", "straps": "Buckle side"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_29','prod_29','QAD-001','[]','4899','active',1,'4899','2400','{"value": 0.5, "unit": "lbs"}','{"length": 4, "width": 2.5, "height": 1, "unit": "inches"}','QAD001BAR','95','standard',1,'[]','{"type": "Digital compass", "keys": "Tactile arrow", "exterior": "Charcoal-toned"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_30','prod_30','VRT-001','[]','3599','active',1,'3599','1800','{"value": 0.4, "unit": "lbs"}','{"length": 4.5, "width": 1.5, "height": 0.8, "unit": "inches"}','VRT001BAR','110','standard',1,'[]','{"motif": "Glowing flame", "body": "Reinforced black", "knob": "Knurled adjustment"}','2025-08-23 16:15:37','2025-08-23 16:15:37');
INSERT INTO "product_variants" VALUES('variant_1_xl','prod_1','VMP-001-XL','[{"option_id": "size", "value": "XL"}]','{"amount": 9999, "currency": "USD"}','active',2,'{"amount": 9999, "currency": "USD"}','{"amount": 5000, "currency": "USD"}','{"value": 2.8, "unit": "lbs"}','{"length": 20, "width": 14, "height": 9, "unit": "inches"}','VMP001XLBAR','{"quantity": 30, "status": "in_stock"}','standard',1,'[]','{"capacity": "12L", "color": "Olive Drab", "material": "Cordura nylon", "size": "XL"}','2025-08-23 23:40:48','2025-08-23 23:40:48');
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
INSERT INTO "promotions" VALUES('promo_cart_20','{"en": "20% Off Orders Over $50"}','cart','{"actions": [{"type": "percentage_discount", "value": 20, "apply_to": "cart_subtotal"}], "conditions": [{"type": "cart_subtotal", "operator": "gte", "value": 5000}]}','active','{"en": "Save 20% on your entire order when you spend $50 or more!"}','save20','{"demo": "true", "campaign": "DEMO-CART-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "SAVE20"}','{"total_uses": 1000, "uses_remaining": 1000, "per_customer": 5}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',100,1,'{"demo_note": "Easy demo code for cart discount testing"}');
INSERT INTO "promotions" VALUES('promo_free_ship','{"en": "Free Shipping"}','shipping','{"actions": [{"type": "shipping_percentage_discount", "value": 100, "apply_to": "shipping_cost"}]}','active','{"en": "Get free shipping on your order - no minimum required!"}','freeship','{"demo": "true", "campaign": "DEMO-FREE-SHIPPING"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "FREESHIP"}','{"total_uses": 1000, "uses_remaining": 1000, "per_customer": 3}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',50,1,'{"demo_note": "Easy demo code for free shipping testing"}');
INSERT INTO "promotions" VALUES('promo_10off','{"en": "$10 Off Any Order"}','cart','{"actions": [{"type": "fixed_discount", "value": 1000, "apply_to": "cart_subtotal"}]}','active','{"en": "Take $10 off your entire order - no minimum required!"}','tenoff','{"demo": "true", "campaign": "DEMO-FIXED-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "10OFF"}','{"total_uses": 500, "uses_remaining": 500, "per_customer": 2}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',75,1,'{"demo_note": "Easy demo code for fixed amount discount testing"}');
INSERT INTO "promotions" VALUES('promo_tools_30','{"en": "30% Off All Tools"}','product','{"actions": [{"type": "item_percentage_discount", "value": 30, "apply_to": "product_price"}], "conditions": [{"type": "product_category", "operator": "in", "value": ["cat_5"]}]}','active','{"en": "Save 30% on all precision tools and tactical gear!"}','toolsale','{"demo": "true", "campaign": "DEMO-CATEGORY-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "TOOLS30"}','{"total_uses": 300, "uses_remaining": 300, "per_customer": 1}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',60,1,'{"demo_note": "Easy demo code for category-specific discount testing"}');
INSERT INTO "promotions" VALUES('promo_vip_25','{"en": "VIP: 25% Off Orders Over $100"}','cart','{"actions": [{"type": "percentage_discount", "value": 25, "apply_to": "cart_subtotal"}], "conditions": [{"type": "cart_subtotal", "operator": "gte", "value": 10000}]}','active','{"en": "VIP customers save big - 25% off when you spend $100 or more!"}','vip25','{"demo": "true", "campaign": "DEMO-VIP-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "VIP25"}','{"total_uses": 100, "uses_remaining": 100, "per_customer": 1}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',200,0,'{"demo_note": "High-value discount code - non-stackable"}');
INSERT INTO "promotions" VALUES('promo_welcome15','{"en": "Welcome: 15% Off First Order"}','cart','{"actions": [{"type": "percentage_discount", "value": 15, "apply_to": "cart_subtotal"}]}','active','{"en": "Welcome to Mercora! Save 15% on your first order with us."}','welcome15','{"demo": "true", "campaign": "DEMO-WELCOME-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "WELCOME15"}','{"total_uses": 1000, "uses_remaining": 1000, "per_customer": 1}','{"customer_types": ["new"], "channels": ["web", "mobile"], "regions": ["US"]}',80,1,'{"demo_note": "First-time customer discount code"}');
INSERT INTO "promotions" VALUES('promo_halfship','{"en": "50% Off Shipping"}','shipping','{"actions": [{"type": "shipping_percentage_discount", "value": 50, "apply_to": "shipping_cost"}]}','active','{"en": "Cut your shipping costs in half with this exclusive offer!"}','halfship','{"demo": "true", "campaign": "DEMO-SHIPPING-DISCOUNT"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-12-31 23:59:59','code','{"generation_type": "single", "single_code": "HALFSHIP"}','{"total_uses": 500, "uses_remaining": 500, "per_customer": 2}','{"customer_types": ["all"], "channels": ["web", "mobile"], "regions": ["US"]}',40,1,'{"demo_note": "50% shipping discount for testing"}');
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
INSERT INTO "coupon_instances" VALUES('coupon_save20','SAVE20','promo_cart_20','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,1000,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_freeship','FREESHIP','promo_free_ship','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,1000,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_10off','10OFF','promo_10off','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,500,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_tools30','TOOLS30','promo_tools_30','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,300,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_vip25','VIP25','promo_vip_25','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,100,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_welcome15','WELCOME15','promo_welcome15','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,1000,NULL,NULL,NULL,NULL);
INSERT INTO "coupon_instances" VALUES('coupon_halfship','HALFSHIP','promo_halfship','active','single_use',NULL,'2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,0,500,NULL,NULL,NULL,NULL);
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
INSERT INTO "inventory" VALUES('inv_1','variant_1','warehouse_main','{"on_hand": 50, "reserved": 0, "available": 50}','active','in_stock','{"legacy_inventory_id": "1"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_2','variant_2','warehouse_main','{"on_hand": 150, "reserved": 0, "available": 150}','active','in_stock','{"legacy_inventory_id": "2"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_3','variant_3','warehouse_main','{"on_hand": 75, "reserved": 0, "available": 75}','active','in_stock','{"legacy_inventory_id": "3"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_4','variant_4','warehouse_main','{"on_hand": 60, "reserved": 0, "available": 60}','active','in_stock','{"legacy_inventory_id": "4"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_5','variant_5','warehouse_main','{"on_hand": 90, "reserved": 0, "available": 90}','active','in_stock','{"legacy_inventory_id": "5"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_6','variant_6','warehouse_main','{"on_hand": 60, "reserved": 0, "available": 60}','active','in_stock','{"legacy_inventory_id": "6"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_7','variant_7','warehouse_main','{"on_hand": 80, "reserved": 0, "available": 80}','active','in_stock','{"legacy_inventory_id": "7"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_8','variant_8','warehouse_main','{"on_hand": 120, "reserved": 0, "available": 120}','active','in_stock','{"legacy_inventory_id": "8"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_9','variant_9','warehouse_main','{"on_hand": 140, "reserved": 0, "available": 140}','active','in_stock','{"legacy_inventory_id": "9"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_10','variant_10','warehouse_main','{"on_hand": 110, "reserved": 0, "available": 110}','active','in_stock','{"legacy_inventory_id": "10"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_11','variant_11','warehouse_main','{"on_hand": 95, "reserved": 0, "available": 95}','active','in_stock','{"legacy_inventory_id": "11"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_12','variant_12','warehouse_main','{"on_hand": 140, "reserved": 0, "available": 140}','active','in_stock','{"legacy_inventory_id": "12"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_13','variant_13','warehouse_main','{"on_hand": 120, "reserved": 0, "available": 120}','active','in_stock','{"legacy_inventory_id": "13"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_14','variant_14','warehouse_main','{"on_hand": 80, "reserved": 0, "available": 80}','active','in_stock','{"legacy_inventory_id": "14"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_15','variant_15','warehouse_main','{"on_hand": 100, "reserved": 0, "available": 100}','active','in_stock','{"legacy_inventory_id": "15"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_16','variant_16','warehouse_main','{"on_hand": 75, "reserved": 0, "available": 75}','active','in_stock','{"legacy_inventory_id": "16"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_17','variant_17','warehouse_main','{"on_hand": 120, "reserved": 0, "available": 120}','active','in_stock','{"legacy_inventory_id": "17"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_18','variant_18','warehouse_main','{"on_hand": 90, "reserved": 0, "available": 90}','active','in_stock','{"legacy_inventory_id": "18"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_19','variant_19','warehouse_main','{"on_hand": 60, "reserved": 0, "available": 60}','active','in_stock','{"legacy_inventory_id": "19"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_20','variant_20','warehouse_main','{"on_hand": 75, "reserved": 0, "available": 75}','active','in_stock','{"legacy_inventory_id": "20"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_21','variant_21','warehouse_main','{"on_hand": 100, "reserved": 0, "available": 100}','active','in_stock','{"legacy_inventory_id": "21"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_22','variant_22','warehouse_main','{"on_hand": 100, "reserved": 0, "available": 100}','active','in_stock','{"legacy_inventory_id": "22"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_23','variant_23','warehouse_main','{"on_hand": 100, "reserved": 0, "available": 100}','active','in_stock','{"legacy_inventory_id": "23"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_24','variant_24','warehouse_main','{"on_hand": 100, "reserved": 0, "available": 100}','active','in_stock','{"legacy_inventory_id": "24"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_25','variant_25','warehouse_main','{"on_hand": 85, "reserved": 0, "available": 85}','active','in_stock','{"legacy_inventory_id": "25"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_26','variant_26','warehouse_main','{"on_hand": 90, "reserved": 0, "available": 90}','active','in_stock','{"legacy_inventory_id": "26"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_27','variant_27','warehouse_main','{"on_hand": 85, "reserved": 0, "available": 85}','active','in_stock','{"legacy_inventory_id": "27"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,5,0,'{}');
INSERT INTO "inventory" VALUES('inv_28','variant_28','warehouse_main','{"on_hand": 115, "reserved": 0, "available": 115}','active','in_stock','{"legacy_inventory_id": "28"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_29','variant_29','warehouse_main','{"on_hand": 95, "reserved": 0, "available": 95}','active','in_stock','{"legacy_inventory_id": "29"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
INSERT INTO "inventory" VALUES('inv_30','variant_30','warehouse_main','{"on_hand": 110, "reserved": 0, "available": 110}','active','in_stock','{"legacy_inventory_id": "30"}','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,0,NULL,10,0,'{}');
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
INSERT INTO "pricing" VALUES('price_1','prod_1','7999','6499','retail','active','{"legacy_price_id": "1", "legacy_sale_id": "1"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,'sale_campaign_2024',NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": true}');
INSERT INTO "pricing" VALUES('price_2','prod_2','2499','1999','retail','active','{"legacy_price_id": "2", "legacy_sale_id": "2"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,'sale_campaign_2024',NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": true}');
INSERT INTO "pricing" VALUES('price_3','prod_3','4999','4299','retail','active','{"legacy_price_id": "3", "legacy_sale_id": "3"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,'sale_campaign_2024',NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": true}');
INSERT INTO "pricing" VALUES('price_4','prod_4','7999','7999','retail','active','{"legacy_price_id": "4"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_5','prod_5','3499','3499','retail','active','{"legacy_price_id": "5"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_6','prod_6','12999','12999','retail','active','{"legacy_price_id": "6"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_7','prod_7','4499','4499','retail','active','{"legacy_price_id": "7"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_8','prod_8','5999','5999','retail','active','{"legacy_price_id": "8"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_9','prod_9','4499','4499','retail','active','{"legacy_price_id": "9"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_10','prod_10','7499','7499','retail','active','{"legacy_price_id": "10"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_11','prod_11','6899','6899','retail','active','{"legacy_price_id": "11"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_12','prod_12','4499','4499','retail','active','{"legacy_price_id": "12"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_13','prod_13','4999','4999','retail','active','{"legacy_price_id": "13"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_14','prod_14','7499','7499','retail','active','{"legacy_price_id": "14"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_15','prod_15','3499','3499','retail','active','{"legacy_price_id": "15"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_16','prod_16','4299','4299','retail','active','{"legacy_price_id": "16"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_17','prod_17','3699','3699','retail','active','{"legacy_price_id": "17"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_18','prod_18','5899','5899','retail','active','{"legacy_price_id": "18"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_19','prod_19','6399','6399','retail','active','{"legacy_price_id": "19"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_20','prod_20','5499','5499','retail','active','{"legacy_price_id": "20"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_21','prod_21','4299','4299','retail','active','{"legacy_price_id": "21"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_22','prod_22','3899','3899','retail','active','{"legacy_price_id": "22"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_23','prod_23','6599','6599','retail','active','{"legacy_price_id": "23"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_24','prod_24','3499','3499','retail','active','{"legacy_price_id": "24"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_25','prod_25','4199','4199','retail','active','{"legacy_price_id": "25"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_26','prod_26','4599','4599','retail','active','{"legacy_price_id": "26"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_27','prod_27','5499','5499','retail','active','{"legacy_price_id": "27"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_28','prod_28','3299','3299','retail','active','{"legacy_price_id": "28"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_29','prod_29','4899','4899','retail','active','{"legacy_price_id": "29"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
INSERT INTO "pricing" VALUES('price_30','prod_30','3599','3599','retail','active','{"legacy_price_id": "30"}','2025-08-23 16:15:37','2025-08-23 16:15:37','2025-08-23 16:15:37',NULL,NULL,NULL,NULL,'{"included": true, "rate": 0.08, "type": "sales_tax"}','USD',1,NULL,NULL,'US','{"on_sale": false}');
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount TEXT NOT NULL, 
    currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
    shipping_address TEXT, 
    billing_address TEXT, 
    items TEXT NOT NULL, 
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
INSERT INTO "orders" VALUES('WEB-USER30ISTJCD9NHBII9YDYXWMVSFPOQ-1756015426682','user_30ISTjcD9nHbIi9ydYXwMVsFPoq','pending','"{\"amount\":21257,\"currency\":\"USD\"}"','USD','"{\"recipient\":\"Russell Moore\",\"email\":\"russellkmoore@mac.com\",\"line1\":\"21311 NE 84th ST\",\"line2\":\"\",\"city\":\"Redmond\",\"region\":\"WA\",\"postal_code\":\"98053\",\"country\":\"US\",\"type\":\"shipping\",\"status\":\"unverified\"}"','"{\"recipient\":\"Russell Moore\",\"email\":\"russellkmoore@mac.com\",\"line1\":\"21311 NE 84th ST\",\"line2\":\"\",\"city\":\"Redmond\",\"region\":\"WA\",\"postal_code\":\"98053\",\"country\":\"US\",\"type\":\"shipping\",\"status\":\"unverified\"}"','"[{\"product_id\":\"prod_1\",\"variant_id\":\"variant_1\",\"sku\":\"prod_1-variant_1\",\"quantity\":1,\"unit_price\":{\"amount\":7999,\"currency\":\"USD\"},\"total_price\":{\"amount\":7999,\"currency\":\"USD\"},\"product_name\":\"Vivid Mission Pack - Regular\"},{\"product_id\":\"prod_1\",\"variant_id\":\"variant_1_xl\",\"sku\":\"prod_1-variant_1_xl\",\"quantity\":1,\"unit_price\":{\"amount\":9999,\"currency\":\"USD\"},\"total_price\":{\"amount\":9999,\"currency\":\"USD\"},\"product_name\":\"Vivid Mission Pack - XL\"}]"','Overnight','stripe','pending',NULL,'2025-08-24T06:03:47.120Z','2025-08-24T06:03:47.120Z',NULL,NULL,NULL,NULL,'"{\"payment_intent_id\":\"pi_3RzX1ULL7e1EcFUl1i5DvidE\",\"shipping_cost\":19.99,\"tax_amount\":1260,\"subtotal\":17998}"');
CREATE TABLE api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_name TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    permissions TEXT NOT NULL, 
    active INTEGER DEFAULT 1 CHECK (active IN (0, 1)),
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    title TEXT,
    context TEXT, 
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_message_at TEXT,
    message_count INTEGER DEFAULT 0,
    extensions TEXT 
);
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    product_ids TEXT, 
    metadata TEXT, 
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
CREATE TABLE order_webhooks (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    webhook_type TEXT NOT NULL CHECK (webhook_type IN ('order_created', 'order_updated', 'payment_completed', 'shipment_created', 'delivery_confirmed')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    payload TEXT NOT NULL, 
    response TEXT, 
    endpoint_url TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_addresses_type ON addresses(type);
CREATE INDEX idx_addresses_status ON addresses(status);
CREATE INDEX idx_addresses_country ON addresses(country);
CREATE INDEX idx_addresses_region ON addresses(region);
CREATE INDEX idx_addresses_postal_code ON addresses(postal_code);
CREATE INDEX idx_addresses_recipient ON addresses(recipient);
CREATE INDEX idx_addresses_created_at ON addresses(created_at);
CREATE INDEX idx_languages_locale ON languages(locale);
CREATE INDEX idx_languages_code ON languages(code);
CREATE INDEX idx_languages_region ON languages(region) WHERE region IS NOT NULL;
CREATE INDEX idx_languages_status ON languages(status);
CREATE INDEX idx_languages_direction ON languages(direction);
CREATE INDEX idx_languages_script ON languages(script) WHERE script IS NOT NULL;
CREATE INDEX idx_languages_created ON languages(created_at);
CREATE INDEX idx_languages_updated ON languages(updated_at);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_status ON media(status);
CREATE INDEX idx_media_type_status ON media(type, status);
CREATE INDEX idx_media_created_at ON media(created_at);
CREATE INDEX idx_media_updated_at ON media(updated_at);
CREATE INDEX idx_customers_type ON customers(type);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_updated_at ON customers(updated_at);
CREATE INDEX idx_customers_type_status ON customers(type, status);
CREATE INDEX idx_categories_status ON categories(status);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_position ON categories(position);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_created_at ON categories(created_at);
CREATE INDEX idx_categories_hierarchy ON categories(parent_id, position);
CREATE INDEX idx_product_types_status ON product_types(status);
CREATE INDEX idx_product_types_parent_type_id ON product_types(parent_type_id) WHERE parent_type_id IS NOT NULL;
CREATE INDEX idx_product_types_version ON product_types(version) WHERE version IS NOT NULL;
CREATE INDEX idx_product_types_created_at ON product_types(created_at);
CREATE INDEX idx_product_types_updated_at ON product_types(updated_at);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_type ON products(type) WHERE type IS NOT NULL;
CREATE INDEX idx_products_brand ON products(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_products_slug ON products(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_updated_at ON products(updated_at);
CREATE INDEX idx_products_fulfillment_type ON products(fulfillment_type);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_status ON product_variants(status);
CREATE INDEX idx_product_variants_position ON product_variants(position) WHERE position IS NOT NULL;
CREATE INDEX idx_product_variants_product_status ON product_variants(product_id, status);
CREATE INDEX idx_promotions_type ON promotions(type);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_activation_method ON promotions(activation_method);
CREATE INDEX idx_promotions_slug ON promotions(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_promotions_valid_from ON promotions(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_promotions_valid_to ON promotions(valid_to) WHERE valid_to IS NOT NULL;
CREATE INDEX idx_promotions_priority ON promotions(priority);
CREATE INDEX idx_coupon_instances_code ON coupon_instances(code);
CREATE INDEX idx_coupon_instances_promotion_id ON coupon_instances(promotion_id);
CREATE INDEX idx_coupon_instances_status ON coupon_instances(status);
CREATE INDEX idx_coupon_instances_assigned_to ON coupon_instances(assigned_to);
CREATE INDEX idx_inventory_sku_location ON inventory(sku_id, location_id);
CREATE INDEX idx_inventory_sku ON inventory(sku_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_stock_status ON inventory(stock_status);
CREATE INDEX idx_pricing_product_id ON pricing(product_id);
CREATE INDEX idx_pricing_status ON pricing(status);
CREATE INDEX idx_pricing_type ON pricing(type);
CREATE INDEX idx_pricing_product_status ON pricing(product_id, status);
CREATE INDEX idx_pricing_valid_from ON pricing(valid_from) WHERE valid_from IS NOT NULL;
CREATE INDEX idx_pricing_valid_to ON pricing(valid_to) WHERE valid_to IS NOT NULL;
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX idx_api_tokens_token_name ON api_tokens(token_name);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_active ON api_tokens(active);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions(last_message_at);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_order_webhooks_order_id ON order_webhooks(order_id);
CREATE INDEX idx_order_webhooks_type ON order_webhooks(webhook_type);
CREATE INDEX idx_order_webhooks_status ON order_webhooks(status);
CREATE INDEX idx_order_webhooks_created_at ON order_webhooks(created_at);
CREATE INDEX idx_order_webhooks_next_retry ON order_webhooks(next_retry_at) WHERE next_retry_at IS NOT NULL;