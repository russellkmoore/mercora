-- Demo review seed data (idempotent)

-- Demo customers referenced by reviews
INSERT OR IGNORE INTO customers (
  id, type, status, created_at, updated_at, person, contacts,
  communication_preferences, segments, tags, loyalty, authentication, extensions
) VALUES
  (
    'cust_demo_reviews_001', 'person', 'active',
    datetime('now','-120 days'), datetime('now'),
    '{"first_name":"Alex","last_name":"Rivera","email":"alex.rivera@example.com"}',
    '[{"type":"email","value":"alex.rivera@example.com","primary":true}]',
    '{"email":true,"sms":false}',
    '[]',
    '["demo","reviews"]',
    '{}', '{}', '{"demo":true}'
  ),
  (
    'cust_demo_reviews_002', 'person', 'active',
    datetime('now','-90 days'), datetime('now'),
    '{"first_name":"Jamie","last_name":"Chen","email":"jamie.chen@example.com"}',
    '[{"type":"email","value":"jamie.chen@example.com","primary":true}]',
    '{"email":true,"sms":false}',
    '[]',
    '["demo","reviews"]',
    '{}', '{}', '{"demo":true}'
  );

-- Orders to keep reviews verified
INSERT OR IGNORE INTO orders (
  id, customer_id, status, total_amount, currency_code, items,
  shipping_method, payment_method, payment_status, notes,
  created_at, updated_at, delivered_at, extensions
) VALUES
  (
    'order_demo_reviews_001', 'cust_demo_reviews_001', 'delivered',
    '{"amount":12999,"currency":"USD"}', 'USD',
    '[{"id":"order_item_demo_001","product_id":"prod_1","variant_id":"variant_1","name":"Frost Hollow Device","quantity":1,"price":{"amount":12999,"currency":"USD"}}]',
    'ground', 'card', 'paid', 'Demo order for reviews',
    datetime('now','-20 days'), datetime('now','-18 days'), datetime('now','-15 days'),
    '{"demo":true}'
  ),
  (
    'order_demo_reviews_002', 'cust_demo_reviews_002', 'delivered',
    '{"amount":6499,"currency":"USD"}', 'USD',
    '[{"id":"order_item_demo_002","product_id":"prod_2","variant_id":"variant_2","name":"Wild Harbor Kit","quantity":1,"price":{"amount":6499,"currency":"USD"}}]',
    'express', 'card', 'paid', 'Demo order for reviews',
    datetime('now','-14 days'), datetime('now','-12 days'), datetime('now','-10 days'),
    '{"demo":true}'
  );

-- Demo product reviews
INSERT OR REPLACE INTO product_reviews (
  id, product_id, order_id, order_item_id, customer_id,
  rating, title, body, status, is_verified,
  automated_moderation, moderation_notes, admin_response, response_author_id,
  responded_at, submitted_at, published_at, created_at, updated_at, metadata
) VALUES
  (
    'review_demo_001', 'prod_1', 'order_demo_reviews_001', 'order_item_demo_001', 'cust_demo_reviews_001',
    5, 'Storm-proof shelter', 'Camped through a 12-hour squall—stayed dry and warm. Setup takes under 5 minutes.',
    'published', 1, NULL, 'Auto-check cleared', 'Thanks for the field report! Stay safe out there.', 'user_admin_root',
    datetime('now','-9 days'), datetime('now','-14 days'), datetime('now','-13 days'),
    datetime('now','-14 days'), datetime('now','-9 days'),
    '{"demo":true,"helpfulVotes":18}'
  ),
  (
    'review_demo_002', 'prod_1', 'order_demo_reviews_001', 'order_item_demo_001', 'cust_demo_reviews_002',
    4, 'Solid but bulky', 'Rock-solid shelter and easy pitching. Would love a lighter fly for long treks.',
    'published', 1, NULL, NULL, NULL, NULL,
    datetime('now','-11 days'), datetime('now','-10 days'),
    datetime('now','-11 days'), datetime('now','-10 days'), datetime('now','-2 days'),
    '{"demo":true,"helpfulVotes":7}'
  ),
  (
    'review_demo_003', 'prod_2', 'order_demo_reviews_002', 'order_item_demo_002', 'cust_demo_reviews_002',
    2, 'Needs QC improvements', 'Zipper snagged right out of the box and one strap was frayed. Flagged for replacement.',
    'needs_review', 1, 'Language safe', 'Escalated to QA for inspection', NULL, NULL,
    datetime('now','-6 days'), NULL, datetime('now','-6 days'), datetime('now','-8 days'), datetime('now','-6 days'),
    '{"demo":true,"flagged":true}'
  );

-- Review media samples
INSERT OR REPLACE INTO review_media (
  id, review_id, type, url, alt_text, metadata
) VALUES
  (
    'review_media_demo_001', 'review_demo_001', 'image',
    'https://files.example-cdn.test/demo/reviews/prod-1-backcountry.jpg',
    'Customer photo: Frost Hollow Device at tree line',
    '{"demo":true}'
  );

-- Flag on the third review for moderation demo
INSERT OR REPLACE INTO review_flags (
  id, review_id, flagged_by, reason, notes, status, created_at, resolved_at
) VALUES
  (
    'review_flag_demo_001', 'review_demo_003', 'moderation_bot',
    'quality_issue', 'Auto-detected hardware defect keywords.',
    'open', datetime('now','-6 days'), NULL
  );

-- Reminder log to showcase review reminder UI
INSERT OR IGNORE INTO review_reminders (
  id, order_id, product_id, customer_id, status, error, sent_at, created_at, updated_at
) VALUES
  (
    'review_reminder_demo_001', 'order_demo_reviews_002', 'prod_2', 'cust_demo_reviews_002',
    'sent', NULL, datetime('now','-8 days'), datetime('now','-8 days'), datetime('now','-8 days')
  );
