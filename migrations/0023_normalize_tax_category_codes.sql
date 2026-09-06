-- Normalize legacy seed tax categories to a valid Stripe tax code.
--
-- The catalog seed carried tax_category = 'standard', which fails
-- priceCheckout's /^txcd_\d{8}$/ check and rejected every checkout with
-- "no valid tax classification". txcd_99999999 is Stripe's
-- "General - Tangible Goods" code and matches store.default_tax_code.
--
-- History: applied directly to production on 2026-08-31 from the
-- fix/dynamic-route-params branch (PR #88) under this exact file name, before
-- 0023_add_order_effects_payload.sql existed. The name is kept so D1's
-- migration ledger matches; both 0023_* files are recorded as applied in
-- production. Data-only, scoped, idempotent: rows already holding a real
-- txcd_ code or NULL are untouched.

UPDATE products
   SET tax_category = 'txcd_99999999'
 WHERE tax_category = 'standard';

UPDATE product_variants
   SET tax_category = 'txcd_99999999'
 WHERE tax_category = 'standard';
