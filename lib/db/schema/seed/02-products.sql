-- Products

INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Vivid Mission Pack',
  'vivid-mission-pack',
  'Compact tactical pack designed for efficient gear organization and rapid deployment.',
  'The Vivid Mission Pack is engineered for agility and performance in demanding environments. Made from durable materials, it offers modular webbing for attachments, a rugged zip system, and a streamlined profile ideal for missions on the move.',
  'products/vivid-mission-pack-0.png',
  'available',
  true,
  true,
  'Ideal for minimalist loadouts and urban recon missions.'
);

-- Get the last inserted product ID (assuming SQLite)
-- SELECT last_insert_rowid();  -- assume this returns 1 for below

-- Price
INSERT INTO product_prices (product_id, price) VALUES (1, 7999);
INSERT INTO product_sale_prices (product_id, sale_price) VALUES (1, 6499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (1, 50);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (1, 'products/vivid-mission-pack-0.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (1, 'tactical'),
  (1, 'military'),
  (1, 'EDC'),
  (1, 'compact');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (1, 'daily carry'),
  (1, 'field ops'),
  (1, 'travel');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (1, 'capacity', '10L'),
  (1, 'material', 'Cordura nylon'),
  (1, 'color', 'Olive Drab');


-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Dusty Fire Tool',
  'dusty-fire-tool',
  'Rugged ferro rod fire starter with high-grip handle for dependable sparks.',
  'The Dusty Fire Tool delivers reliable ignition even in wet and windy conditions. Its ergonomic grip, long-lasting ferrocerium rod, and integrated striker make it an essential tool for survivalists, campers, and adventurers.',
  'products/dusty-fire-tool-1.png',
  'available',
  true,
  true,
  'Perfect for backcountry expeditions and emergency preparedness kits.'
);

-- Assuming product ID is 2

-- Price
INSERT INTO product_prices (product_id, price) VALUES (2, 2499);
INSERT INTO product_sale_prices (product_id, sale_price) VALUES (2, 1999);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (2, 150);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (2, 'products/dusty-fire-tool-1.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (2, 'firestarter'),
  (2, 'survival'),
  (2, 'EDC');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (2, 'camping'),
  (2, 'survival'),
  (2, 'emergency kits');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (2, 'length', '5 inches'),
  (2, 'material', 'ferrocerium & polymer grip'),
  (2, 'color', 'Charcoal Black');

-- Alternate images for Dusty Fire Tool
INSERT INTO product_images (product_id, image_url) VALUES
  (2, 'products/dusty-fire-tool-1a.png'),
  (2, 'products/dusty-fire-tool-1b.png'),
  (2, 'products/dusty-fire-tool-1c.png');


-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Echo Sky Kit',
  'echo-sky-kit',
  'Compact emergency radio and comms unit with built-in weather alerts.',
  'The Echo Sky Kit is your lifeline in the wild. With NOAA weather alerts, FM/AM tuning, and a powerful built-in flashlight, it ensures communication and safety during backcountry treks, storms, or power outages. Comes with a rugged carabiner and durable antenna.',
  'products/echo-sky-kit-2.png',
  'available',
  true,
  true,
  'Designed for off-grid communication and storm readiness. Compact and rugged enough to clip onto any pack.'
);

-- Assuming product ID is 3

-- Price
INSERT INTO product_prices (product_id, price) VALUES (3, 4999);
INSERT INTO product_sale_prices (product_id, sale_price) VALUES (3, 4299);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (3, 75);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (3, 'products/echo-sky-kit-2.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (3, 'radio'),
  (3, 'emergency'),
  (3, 'communication');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (3, 'storm prep'),
  (3, 'off-grid living'),
  (3, 'camping');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (3, 'battery', 'Rechargeable lithium-ion'),
  (3, 'bands', 'AM/FM/NOAA'),
  (3, 'color', 'Tactical Black');





-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Lunar Signal Pack',
  'lunar-signal-pack',
  'Advanced tactical backpack with comms-ready organization.',
  'The Lunar Signal Pack is engineered for rapid deployment scenarios and long-range excursions. It includes modular compartments for tech gear, hydration, and communication tools, along with reinforced MOLLE webbing for accessory attachments. Built to endure lunar light or midnight missions.',
  'products/lunar-signal-pack-3.png',
  'available',
  false,
  true,
  'Developed for tactical operators and adventurers alike. Ideal for both urban carry and expedition use.'
);

-- Assuming product ID is 4

-- Price
INSERT INTO product_prices (product_id, price) VALUES (4, 7999);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (4, 60);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (4, 'products/lunar-signal-pack-3.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (4, 'tactical'),
  (4, 'rugged'),
  (4, 'gear');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (4, 'field operations'),
  (4, 'signal kit storage'),
  (4, 'outdoor missions');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (4, 'capacity', '28L'),
  (4, 'material', 'Ballistic Nylon'),
  (4, 'color', 'Carbon Black');




-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Twin Dune Tool',
  'twin-dune-tool',
  'Compact dual-head survival wrench with tactical wrap.',
  'Designed for versatility in the harshest conditions, the Twin Dune Tool combines a dual wrench head with a prying edge and hex slot. Wrapped in durable paracord for added grip and emergency use, it’s ideal for quick field adjustments or breaking free from the unexpected.',
  'products/twin-dune-tool-4.png',
  'available',
  false,
  true,
  'Perfect for field engineers, survivalists, or minimalist gear kits. Its design is inspired by extreme desert conditions and lunar utility.'
);

-- Assuming product ID is 5

-- Price
INSERT INTO product_prices (product_id, price) VALUES (5, 3499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (5, 90);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (5, 'products/twin-dune-tool-4.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (5, 'multi-tool'),
  (5, 'compact'),
  (5, 'durable');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (5, 'field repair'),
  (5, 'emergency gear'),
  (5, 'lightweight carry');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (5, 'length', '5.5 in'),
  (5, 'material', 'Anodized Steel'),
  (5, 'grip', 'Paracord wrapped');





-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Polar Leaf Device',
  'polar-leaf-device',
  'Durable GPS navigation tool for extreme environments.',
  'The Polar Leaf Device is a rugged GPS navigation system built for zero-visibility terrain and remote operations. With tactile buttons, high-contrast display, and reinforced housing, it’s ideal for search and rescue teams, backcountry explorers, and off-grid adventurers.',
  'products/polar-leaf-device-5.png',
  'available',
  false,
  true,
  'Tailored for survivalists and professionals navigating the wilderness. Cold-resistant with a rubberized shell for enhanced grip in arctic gear.'
);

-- Assuming product ID is 6

-- Price
INSERT INTO product_prices (product_id, price) VALUES (6, 12999);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (6, 60);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (6, 'products/polar-leaf-device-5.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (6, 'gps'),
  (6, 'navigation'),
  (6, 'rugged');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (6, 'backcountry navigation'),
  (6, 'emergency signaling'),
  (6, 'expedition tracking');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (6, 'battery life', '36 hours'),
  (6, 'screen', 'Monochrome LCD'),
  (6, 'waterproof', 'IP68'),
  (6, 'input method', 'Physical buttons');





-- Products
INSERT INTO products (name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes)
VALUES (
  'Rapid Wave Kit',
  'rapid-wave-kit',
  'Compact emergency communication and survival pouch.',
  'The Rapid Wave Kit is a go-anywhere emergency essentials pouch featuring a rugged shell, internal compartments, and a quick-clip carabiner. Designed for first response and outdoor readiness, this kit is ideal for organizing quick-access tools, signaling gear, or hydration tablets.',
  'products/rapid-wave-kit-6.png',
  'available',
  false,
  true,
  'Compact and versatile, the Rapid Wave Kit serves as a mobile command pouch for outdoor responders, campers, or utility belt configurations.'
);

-- Assuming product ID is 7

-- Price
INSERT INTO product_prices (product_id, price) VALUES (7, 4499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (7, 80);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (7, 'products/rapid-wave-kit-6.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (7, 'emergency kit'),
  (7, 'tactical'),
  (7, 'compact');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (7, 'first aid storage'),
  (7, 'outdoor readiness'),
  (7, 'go-bag supplement');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (7, 'material', 'Heavy-duty canvas'),
  (7, 'dimensions', '6x4x2 inches'),
  (7, 'attachment', 'Carabiner clip and MOLLE straps'),
  (7, 'weight', '0.4 lbs');




-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Eagle Shadow Tool',
  'eagle-shadow-tool',
  'A rugged multitool with a tactical blade and integrated clip.',
  'The Eagle Shadow Tool is engineered for stealth and function. Designed with a reinforced tanto-style blade, integrated bottle opener, and a carabiner clip for easy carry, this is the tool for adventurers, rescue operators, or EDC enthusiasts needing quick utility access in the field.',
  'products/eagle-shadow-tool-7.png',
  'available',
  false,
  true,
  'Features a tanto blade for piercing strength and tactical design. Built-in carabiner enables easy access on bags or belts. Reliable for EDC or field utility.'
);

-- Assuming product ID is 8

-- Price
INSERT INTO product_prices (product_id, price) VALUES (8, 5999);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (8, 120);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (8, 'products/eagle-shadow-tool-7.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (8, 'multitool'),
  (8, 'edc'),
  (8, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (8, 'everyday carry'),
  (8, 'emergency access'),
  (8, 'survival situations');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (8, 'blade_style', 'Tanto'),
  (8, 'material', 'High-carbon stainless steel'),
  (8, 'features', 'Carabiner clip, bottle opener'),
  (8, 'length_closed', '4.3 inches'),
  (8, 'weight', '0.3 lbs');




-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Storm Orbit Device',
  'storm-orbit-device',
  'A compact, wearable tactical flashlight with high-intensity output.',
  'The Storm Orbit Device is a rugged, wrist-mounted flashlight engineered for hands-free illumination in tactical and emergency scenarios. Featuring an ultra-bright LED core, water-resistant housing, and durable strap, it’s perfect for night operations, search and rescue, or utility work.',
  'products/storm-orbit-device-8.png',
  'available',
  false,
  true,
  'Compact wrist-mounted tactical light. Bright LED for high visibility. Ideal for emergency services, outdoor survival, or night patrol.'
);

-- Assuming product ID is 9

-- Price
INSERT INTO product_prices (product_id, price) VALUES (9, 4499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (9, 140);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (9, 'products/storm-orbit-device-8.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (9, 'flashlight'),
  (9, 'wearable'),
  (9, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (9, 'hands-free illumination'),
  (9, 'emergency visibility'),
  (9, 'tactical operations');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (9, 'light_output', '350 lumens'),
  (9, 'battery_life', '12 hours'),
  (9, 'mount_type', 'adjustable strap'),
  (9, 'water_resistant', 'IP65'),
  (9, 'weight', '0.2 lbs');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Coastal Track Pack',
  'coastal-track-pack',
  'A durable roll-top backpack designed for rugged coastal adventures.',
  'The Coastal Track Pack combines tactical durability with modern utility. Its roll-top closure ensures protection from the elements, while the large capacity, side mesh pockets, and front MOLLE webbing provide versatile storage for outdoor gear, hydration, and quick-access tools.',
  'products/coastal-track-pack-9.png',
  'available',
  false,
  true,
  'Roll-top tactical backpack with MOLLE system. Suited for coastal hikes, tactical expeditions, and gear transport in wet conditions.'
);

-- Assuming product ID is 10

-- Price
INSERT INTO product_prices (product_id, price) VALUES (10, 7499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (10, 110);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (10, 'products/coastal-track-pack-9.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (10, 'backpack'),
  (10, 'roll-top'),
  (10, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (10, 'coastal hiking'),
  (10, 'weatherproof storage'),
  (10, 'multi-day carry');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (10, 'capacity', '35L'),
  (10, 'material', 'water-resistant nylon'),
  (10, 'closure', 'roll-top with buckle'),
  (10, 'weight', '2.1 lbs'),
  (10, 'molle_webbing', 'yes');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Noble Field Pack',
  'noble-field-pack',
  'A vintage-style canvas field pack for enduring utility and rugged style.',
  'The Noble Field Pack is a timeless design built for field versatility. Constructed with heavy-duty canvas and leather trim, it’s perfect for day hikes, urban exploring, or workday carry. Features include dual buckle straps, external pockets, and compression side straps for tailored storage.',
  'products/noble-field-pack-10.png',
  'available',
  false,
  true,
  'Classic brown field backpack with canvas exterior and buckle straps. Ideal for field work, university carry, or weekend hikes.'
);

-- Assuming product ID is 11

-- Price
INSERT INTO product_prices (product_id, price) VALUES (11, 6899);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (11, 95);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (11, 'products/noble-field-pack-10.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (11, 'backpack'),
  (11, 'canvas'),
  (11, 'heritage');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (11, 'fieldwork'),
  (11, 'daily carry'),
  (11, 'outdoor exploration');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (11, 'capacity', '30L'),
  (11, 'material', 'waxed canvas and leather'),
  (11, 'closure', 'dual buckle flap'),
  (11, 'weight', '2.3 lbs'),
  (11, 'color', 'earth brown');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Nova Flame Device',
  'nova-flame-device',
  'A tactical jet flame torch for rugged field ignition.',
  'The Nova Flame Device delivers powerful, windproof flame performance in any environment. Designed for tactical use, it features a safety lock, angled burner, and carabiner clip for secure attachment. Built with impact-resistant housing, it’s an essential fire tool for the wild.',
  'products/nova-flame-device-11.png',
  'available',
  false,
  true,
  'Compact black torch with angled flame nozzle and red accent. Ideal for outdoor ignition in wind or rain.'
);

-- Assuming product ID is 12

-- Price
INSERT INTO product_prices (product_id, price) VALUES (12, 4499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (12, 140);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (12, 'products/nova-flame-device-11.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (12, 'torch'),
  (12, 'flame'),
  (12, 'ignition');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (12, 'campfire lighting'),
  (12, 'emergency ignition'),
  (12, 'field utility');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (12, 'flame type', 'jet torch'),
  (12, 'windproof', 'yes'),
  (12, 'material', 'impact-resistant ABS'),
  (12, 'color', 'black with red accents'),
  (12, 'attachment', 'integrated carabiner clip');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Solar Arc Tool',
  'solar-arc-tool',
  'A rugged solar-powered arc ignition device.',
  'The Solar Arc Tool provides reliable ignition using solar energy and an internal rechargeable arc system. Designed for off-grid readiness, it features a solar panel, arc ignition button, and durable weather-resistant body. Ideal for sustainable field operations and emergency kits.',
  'products/solar-arc-tool-12.png',
  'available',
  false,
  true,
  'Compact black ignition device with solar panel and orange button. Built for off-grid utility and renewable energy use.'
);

-- Assuming product ID is 13

-- Price
INSERT INTO product_prices (product_id, price) VALUES (13, 4999);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (13, 120);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (13, 'products/solar-arc-tool-12.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (13, 'solar'),
  (13, 'ignition'),
  (13, 'renewable');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (13, 'emergency ignition'),
  (13, 'off-grid utility'),
  (13, 'eco-friendly preparedness');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (13, 'power source', 'solar + rechargeable battery'),
  (13, 'ignition type', 'arc'),
  (13, 'material', 'weather-resistant polymer'),
  (13, 'color', 'black with orange accent'),
  (13, 'size', 'pocket-sized');






-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Shadow Trail Pack',
  'shadow-trail-pack',
  'A stealthy and durable backpack for rugged trails.',
  'The Shadow Trail Pack is designed for minimal visibility and maximum functionality on rugged trails. Featuring a dark tactical finish, multi-compartment design, secure flap buckle, and side utility pockets, it’s built for serious explorers and urban operators alike.',
  'products/shadow-trail-pack-13.png',
  'available',
  false,
  true,
  'Matte black tactical backpack with buckle closure, side pockets, and reinforced build for trail and stealth use.'
);

-- Assuming product ID is 14

-- Price
INSERT INTO product_prices (product_id, price) VALUES (14, 7499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (14, 80);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (14, 'products/shadow-trail-pack-13.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (14, 'backpack'),
  (14, 'tactical'),
  (14, 'trail');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (14, 'rugged trails'),
  (14, 'urban carry'),
  (14, 'stealth operations');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (14, 'material', 'heavy-duty nylon'),
  (14, 'color', 'matte black'),
  (14, 'capacity', '24L'),
  (14, 'features', 'multiple compartments, secure buckle, side pockets'),
  (14, 'weather resistant', 'yes');






-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Wild Harbor Kit',
  'wild-harbor-kit',
  'Compact all-purpose pouch for remote operations.',
  'The Wild Harbor Kit is a rugged, minimalist pouch designed for portability and utility. Ideal for field medics, travelers, or tacticians, this durable kit features dual-zippered compartments, reinforced stitching, and modular attachment loops for a streamlined experience in any environment.',
  'products/wild-harbor-kit-14.png',
  'available',
  false,
  true,
  'Compact tactical pouch with dual-zipper compartments, rugged handle, and modular loops for tool or medical storage.'
);

-- Assuming product ID is 15

-- Price
INSERT INTO product_prices (product_id, price) VALUES (15, 3499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (15, 100);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (15, 'products/wild-harbor-kit-14.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (15, 'kit'),
  (15, 'pouch'),
  (15, 'field');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (15, 'remote operations'),
  (15, 'travel kit'),
  (15, 'field medical');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (15, 'material', 'reinforced canvas'),
  (15, 'color', 'earth brown'),
  (15, 'capacity', '1.5L'),
  (15, 'features', 'dual-zipper compartments, modular loops, carry handle'),
  (15, 'weather resistant', 'yes');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Iron Echo Tool',
  'iron-echo-tool',
  'Heavy-duty tactical tool for extreme impact applications.',
  'The Iron Echo Tool is a reinforced tactical impact device, combining brute strength with ergonomic design. Featuring a precision-milled tip for breaking barriers, a carabiner loop for rapid access, and skeletonized panels for reduced weight, this tool is trusted by operators in critical breaching or rescue operations.',
  'products/iron-echo-tool-15.png',
  'available',
  false,
  true,
  'Impact breaching tool with a pointed hardened tip, skeletonized grip for lightweight handling, and tactical clip and loop for secure carry.'
);

-- Assuming product ID is 16

-- Price
INSERT INTO product_prices (product_id, price) VALUES (16, 4299);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (16, 75);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (16, 'products/iron-echo-tool-15.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (16, 'tool'),
  (16, 'impact'),
  (16, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (16, 'rescue operations'),
  (16, 'window breaching'),
  (16, 'emergency escape');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (16, 'material', 'anodized aluminum'),
  (16, 'color', 'matte black'),
  (16, 'weight', '185g'),
  (16, 'features', 'hardened tip, carabiner loop, belt clip, skeleton grip'),
  (16, 'weather resistant', 'yes');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Prism Blaze Device',
  'prism-blaze-device',
  'High-intensity tactical flashlight with rugged design.',
  'The Prism Blaze Device is a high-lumen tactical flashlight engineered for maximum durability and visibility in critical operations. Its dual-tone rugged casing ensures secure grip, while the focused reflector cone provides concentrated beam intensity ideal for search, signaling, or field navigation.',
  'products/prism-blaze-device-16.png',
  'available',
  false,
  true,
  'Features high-powered LED with focused optics, shockproof body, and molded grip zones. Excellent for tactical, outdoor, and emergency use.'
);

-- Assuming product ID is 17

-- Price
INSERT INTO product_prices (product_id, price) VALUES (17, 3699);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (17, 120);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (17, 'products/prism-blaze-device-16.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (17, 'flashlight'),
  (17, 'lighting'),
  (17, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (17, 'night operations'),
  (17, 'signal lighting'),
  (17, 'emergency response');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (17, 'lumens', '800'),
  (17, 'battery type', 'rechargeable lithium-ion'),
  (17, 'color', 'black and blaze orange'),
  (17, 'weight', '160g'),
  (17, 'water resistant', 'yes');




-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Crimson Path Pack',
  'crimson-path-pack',
  'Bold and rugged backpack for trail and travel.',
  'The Crimson Path Pack combines robust utility with bold aesthetics, featuring reinforced straps, MOLLE webbing, and expansive compartmental design. Ideal for adventurous commuters or trailblazers seeking a standout look with serious function.',
  'products/crimson-path-pack-17.png',
  'available',
  false,
  true,
  'Equipped with adjustable sternum strap, mesh side pockets, and weather-resistant fabric. Ideal for daily carry, trekking, and outdoor missions.'
);

-- Assuming product ID is 18

-- Price
INSERT INTO product_prices (product_id, price) VALUES (18, 5899);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (18, 90);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (18, 'products/crimson-path-pack-17.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (18, 'backpack'),
  (18, 'trail'),
  (18, 'outdoor');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (18, 'trail hiking'),
  (18, 'urban travel'),
  (18, 'gear hauling');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (18, 'color', 'crimson red and black'),
  (18, 'material', 'ripstop canvas'),
  (18, 'capacity', '32L'),
  (18, 'weight', '1.2kg'),
  (18, 'water resistant', 'yes');


-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Arctic Pulse Tool',
  'arctic-pulse-tool',
  'Precision pulse monitor in rugged arctic-grade housing.',
  'Engineered for extreme environments, the Arctic Pulse Tool features an integrated pulse sensor, high-visibility readout, and a protective outer casing built to withstand the elements. Its durable construction and carabiner-ready design make it perfect for high-altitude and cold-weather expeditions.',
  'products/arctic-pulse-tool-18.png',
  'available',
  false,
  true,
  'Displays real-time pulse waveform; ideal for emergency response kits, mountaineering teams, or scientific expeditions in cold climates.'
);

-- Assuming product ID is 19

-- Price
INSERT INTO product_prices (product_id, price) VALUES (19, 6399);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (19, 60);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (19, 'products/arctic-pulse-tool-18.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (19, 'tool'),
  (19, 'health'),
  (19, 'monitoring');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (19, 'medical monitoring'),
  (19, 'cold environment survival'),
  (19, 'mountain expeditions');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (19, 'color', 'arctic blue and black'),
  (19, 'material', 'impact-resistant polymer'),
  (19, 'power', 'rechargeable battery'),
  (19, 'sensor', 'pulse + waveform display'),
  (19, 'weather rated', 'IP67');


-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Zenith Rock Kit',
  'zenith-rock-kit',
  'Durable geological sampling pack for fieldwork and discovery.',
  'Designed for rockhounds and geologists alike, the Zenith Rock Kit is a compact, rugged field pack ideal for carrying tools, samples, and essentials. Reinforced with MOLLE webbing and padded compartments, it is built to support rough terrain and long excursions.',
  'products/zenith-rock-kit-19.png',
  'available',
  false,
  true,
  'Perfect for geological exploration, fossil collection, and rugged outdoor research expeditions. Highly portable and weather-resistant.'
);


-- Price
INSERT INTO product_prices (product_id, price) VALUES (20, 5499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (20, 75);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (20, 'products/zenith-rock-kit-19.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (20, 'kit'),
  (20, 'geology'),
  (20, 'outdoor');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (20, 'rock collection'),
  (20, 'field geology'),
  (20, 'outdoor education');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (20, 'color', 'earth brown'),
  (20, 'material', 'heavy-duty canvas'),
  (20, 'compartments', 'multi-zip with MOLLE support'),
  (20, 'strap system', 'adjustable and reinforced'),
  (20, 'capacity', 'small tactical loadout');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Stealth Brook Device',
  'stealth-brook-device',
  'Compact tactical flashlight for stealth and utility.',
  'The Stealth Brook Device is a lightweight, pocket-sized tactical flashlight built for covert operations and nighttime navigation. Featuring textured grip zones, a recessed power switch, and a rugged clip, it provides reliability and discretion in low-light environments.',
  'products/stealth-brook-device-20.png',
  'available',
  false,
  true,
  'Ideal for camping, night treks, or emergency use. Compact yet powerful with easy-to-access controls and durable all-weather construction.'
);

-- Assuming product ID is 21

-- Price
INSERT INTO product_prices (product_id, price) VALUES (21, 4299);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (21, 100);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (21, 'products/stealth-brook-device-20.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (21, 'device'),
  (21, 'flashlight'),
  (21, 'tactical');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (21, 'night operations'),
  (21, 'emergency lighting'),
  (21, 'camp navigation');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (21, 'color', 'matte black'),
  (21, 'material', 'aerospace aluminum'),
  (21, 'light output', '700 lumens'),
  (21, 'power source', 'rechargeable battery'),
  (21, 'water resistance', 'IPX6');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Comet Trace Tool',
  'comet-trace-tool',
  'Multifunctional compact tool with durable sheath.',
  'The Comet Trace Tool is a robust, compact utility tool housed in a protective tactical sheath. Crafted from high-strength alloy, it includes multiple integrated functions such as a hex wrench, pry edge, and screw bit interface, making it ideal for field adjustments and gear maintenance.',
  'products/comet-trace-tool-21.png',
  'available',
  false,
  true,
  'Excellent for field repairs, everyday carry, or survival kits. Sleek and tactical, it includes a MOLLE-compatible sheath and corrosion-resistant finish.'
);

-- Assuming product ID is 22

-- Price
INSERT INTO product_prices (product_id, price) VALUES (22, 3899);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (22, 100);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (22, 'products/comet-trace-tool-21.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (22, 'tool'),
  (22, 'multitool'),
  (22, 'field');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (22, 'gear maintenance'),
  (22, 'survival'),
  (22, 'EDC');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (22, 'color', 'tactical gray'),
  (22, 'material', 'hardened steel alloy'),
  (22, 'sheath', 'included tactical MOLLE pouch'),
  (22, 'functions', 'hex wrench, pry bar, bit driver'),
  (22, 'finish', 'corrosion-resistant');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Onyx Surge Pack',
  'onyx-surge-pack',
  'Stealth-ready tactical backpack for dynamic loads.',
  'The Onyx Surge Pack is engineered for durability and capacity, perfect for fast-response missions or heavy-duty daily use. Built with rugged nylon, internal organization, hydration compatibility, and MOLLE webbing throughout, this pack supports high-performance demands in stealth and style.',
  'products/onyx-surge-pack-22.png',
  'available',
  false,
  true,
  'Ideal for tactical operators, outdoor missions, or urban carry. Equipped with compression straps, reinforced stitching, and padded support to carry heavy loads comfortably.'
);

-- Assuming product ID is 23

-- Price
INSERT INTO product_prices (product_id, price) VALUES (23, 6599);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (23, 100);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (23, 'products/onyx-surge-pack-22.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (23, 'pack'),
  (23, 'tactical'),
  (23, 'stealth');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (23, 'tactical deployment'),
  (23, 'urban carry'),
  (23, 'gear hauling');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (23, 'color', 'onyx black'),
  (23, 'capacity', '35L'),
  (23, 'material', 'ballistic nylon'),
  (23, 'features', 'MOLLE webbing, hydration-ready, internal compartments'),
  (23, 'weight', '1.4kg');






-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Bright Echo Kit',
  'bright-echo-kit',
  'Compact field pouch for fast-access essentials.',
  'The Bright Echo Kit offers utility in a small form—perfect for tactical medics, quick-access gear, or field tech tools. Durable canvas with reinforced loops and MOLLE-compatible design ensure seamless integration with packs or belts.',
  'products/bright-echo-kit-23.png',
  'available',
  false,
  true,
  'Great for on-the-go operations, first aid, or communication gear. Includes quick-release buckle, interior compartments, and weather-resistant build.'
);

-- Assuming product ID is 24

-- Price
INSERT INTO product_prices (product_id, price) VALUES (24, 3499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (24, 100);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (24, 'products/bright-echo-kit-23.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (24, 'kit'),
  (24, 'tactical'),
  (24, 'compact');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (24, 'medical pack'),
  (24, 'field tools'),
  (24, 'belt attachment');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (24, 'color', 'ranger green'),
  (24, 'capacity', '3L'),
  (24, 'material', 'tactical canvas'),
  (24, 'features', 'MOLLE-compatible, quick-release, waterproof zippers'),
  (24, 'weight', '0.4kg');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Frost Hollow Device',
  'frost-hollow-device',
  'Cold-weather survival beacon and tracker.',
  'The Frost Hollow Device is engineered for extreme environments. With ruggedized housing, a thermal-safe grip, and insulated electronics, it’s perfect for signaling, location tracking, or activating cold-weather gear. Designed to survive the frostiest expeditions.',
  'products/frost-hollow-device-24.png',
  'available',
  false,
  true,
  'Built to withstand sub-zero conditions. Features a high-grip texture, compact body, lanyard loop, and oversized knob for use with gloves.'
);

-- Assuming product ID is 25

-- Price
INSERT INTO product_prices (product_id, price) VALUES (25, 4199);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (25, 85);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (25, 'products/frost-hollow-device-24.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (25, 'device'),
  (25, 'winter'),
  (25, 'emergency');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (25, 'cold weather expeditions'),
  (25, 'tracking beacon'),
  (25, 'emergency signaling');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (25, 'color', 'stone grey'),
  (25, 'material', 'polymer composite with rubber grip'),
  (25, 'features', 'cold-resistant, waterproof, glove-friendly controls'),
  (25, 'dimensions', '11.8cm x 7.2cm x 3.5cm'),
  (25, 'weight', '0.48kg');




-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Signal Glade Tool',
  'signal-glade-tool',
  'Compact comms and navigation interface.',
  'The Signal Glade Tool is a rugged, palm-sized unit for communication, beaconing, and emergency data relay. Designed with a bright display and textured grips, this device fits field teams needing connectivity and signal clarity in wilderness or off-grid zones.',
  'products/signal-glade-tool-25.png',
  'available',
  false,
  true,
  'Wide signal support in compact form factor. Features a shock-resistant screen frame, reinforced rubber grip zones, tactical green shell, and a bright orange cord for visibility.'
);

-- Assuming product ID is 26

-- Price
INSERT INTO product_prices (product_id, price) VALUES (26, 4599);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (26, 90);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (26, 'products/signal-glade-tool-25.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (26, 'tool'),
  (26, 'communications'),
  (26, 'navigation');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (26, 'remote communication'),
  (26, 'emergency signal relay'),
  (26, 'team coordination in field');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (26, 'color', 'olive green with orange accents'),
  (26, 'material', 'impact polymer and rubberized grip'),
  (26, 'features', 'communication beacon, screen display, durable body'),
  (26, 'dimensions', '13.5cm x 8.5cm x 3.5cm'),
  (26, 'weight', '0.39kg');


-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Ember Crest Pack',
  'ember-crest-pack',
  'Bold field pack for elevated excursions.',
  'The Ember Crest Pack features a dual-tone design with a sharp ember-colored panel accenting the front, secured with front buckles and dual side straps. Designed for adventure with tactical styling, it’s ideal for those who want a sturdy carry with flair.',
  'products/ember-crest-pack-26.png',
  'available',
  false,
  true,
  'Black rugged pack with ember red geometric front panel. Features buckle flap closure, outer zip pocket, adjustable compression straps, and reinforced shoulder harness for extended wear.'
);

-- Assuming product ID is 27

-- Price
INSERT INTO product_prices (product_id, price) VALUES (27, 5499);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (27, 85);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (27, 'products/ember-crest-pack-26.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (27, 'pack'),
  (27, 'adventure'),
  (27, 'field gear');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (27, 'day hikes'),
  (27, 'outdoor excursions'),
  (27, 'tactical preparedness');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (27, 'color', 'black with ember orange accents'),
  (27, 'material', 'heavy-duty canvas and nylon'),
  (27, 'features', 'top flap buckle, front pocket, side cinch straps'),
  (27, 'dimensions', '50cm x 32cm x 18cm'),
  (27, 'capacity', '32L');





-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Sunbeam Range Kit',
  'sunbeam-range-kit',
  'Compact carry pouch in bright mustard yellow.',
  'The Sunbeam Range Kit is a standout utility pouch with a rugged mustard-colored canvas exterior. Featuring a front zipper pocket and durable buckle side straps, this kit is perfect for carrying essential gear in style.',
  'products/sunbeam-range-kit-27.png',
  'available',
  false,
  true,
  'Mustard yellow compact kit with a top carry handle, black front zipper, and dark olive side buckle straps. Clean stitched patch label adds a refined touch. Ideal for organizing essentials.'
);

-- Assuming product ID is 28

-- Price
INSERT INTO product_prices (product_id, price) VALUES (28, 3299);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (28, 115);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (28, 'products/sunbeam-range-kit-27.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (28, 'kit'),
  (28, 'compact gear'),
  (28, 'utility');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (28, 'gear storage'),
  (28, 'travel essentials'),
  (28, 'daily carry');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (28, 'color', 'mustard yellow'),
  (28, 'material', 'durable canvas'),
  (28, 'features', 'zippered front pocket, side buckle straps, top carry handle'),
  (28, 'dimensions', '22cm x 15cm x 8cm'),
  (28, 'capacity', '2L');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Quantum Ash Device',
  'quantum-ash-device',
  'Compact navigation device with rugged black casing.',
  'The Quantum Ash Device is a tactical digital compass encased in a rugged, charcoal-toned exterior. Equipped with tactile arrow keys and an "OK" selection button, it’s built for precision and durability in outdoor conditions.',
  'products/quantum-ash-device-28.png',
  'available',
  false,
  true,
  'Charcoal black nav-device with analog-style digital compass interface. Features rubberized side grips, top antenna, durable directional buttons, and lanyard loop. Built for field utility.'
);

-- Assuming product ID is 29

-- Price
INSERT INTO product_prices (product_id, price) VALUES (29, 4899);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (29, 95);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (29, 'products/quantum-ash-device-28.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (29, 'device'),
  (29, 'navigation'),
  (29, 'outdoor tech');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (29, 'directional tracking'),
  (29, 'hiking'),
  (29, 'tactical navigation');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (29, 'color', 'charcoal black'),
  (29, 'interface', 'digital compass with directional controls'),
  (29, 'features', 'directional buttons, antenna, wrist lanyard, OK confirmation button'),
  (29, 'dimensions', '10cm x 6cm x 3cm'),
  (29, 'power', 'rechargeable battery');



-- Products
INSERT INTO products (
  name, slug, short_description, long_description, primary_image_url, availability, on_sale, active, ai_notes
) VALUES (
  'Volcanic Ridge Tool',
  'volcanic-ridge-tool',
  'Fire-themed utility tool with rugged grip and glowing flame tip.',
  'The Volcanic Ridge Tool is a compact, fire-inspired utility tool featuring a glowing flame motif. Designed for durability and performance, it sports a reinforced black body with textured grips, a knurled adjustment knob, and integrated carabiner loop.',
  'products/volcanic-ridge-tool-29.png',
  'available',
  false,
  true,
  'Compact fire-themed tool with black rugged polymer casing. Features illuminated flame tip, knurled side dial, integrated carabiner, and bright orange label. Ideal for emergency signal or survival applications.'
);

-- Assuming product ID is 30

-- Price
INSERT INTO product_prices (product_id, price) VALUES (30, 3599);

-- Inventory
INSERT INTO product_inventory (product_id, quantity_in_stock) VALUES (30, 110);

-- Images
INSERT INTO product_images (product_id, image_url) VALUES (30, 'products/volcanic-ridge-tool-29.png');

-- Tags
INSERT INTO product_tags (product_id, tag) VALUES
  (30, 'tool'),
  (30, 'survival'),
  (30, 'fire starter');

-- Use Cases
INSERT INTO product_use_cases (product_id, use_case) VALUES
  (30, 'emergency signaling'),
  (30, 'fire starting aid'),
  (30, 'outdoor survival');

-- Attributes
INSERT INTO product_attributes (product_id, key, value) VALUES
  (30, 'color', 'black and orange'),
  (30, 'lighting', 'flame-shaped illumination tip'),
  (30, 'features', 'carabiner, ergonomic grip, control dial, loop base'),
  (30, 'material', 'reinforced thermoplastic'),
  (30, 'dimensions', '12cm x 5cm x 3.5cm');


