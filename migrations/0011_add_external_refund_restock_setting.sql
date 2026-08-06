INSERT OR IGNORE INTO admin_settings (
  key, value, category, description, data_type, created_at, updated_at
) VALUES (
  'refund.external_full_restock_enabled',
  'false',
  'refund',
  'Restock every outstanding line after a full Stripe Dashboard refund',
  'boolean',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
