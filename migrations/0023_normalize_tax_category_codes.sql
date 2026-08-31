-- Normalize catalog tax classifications to Stripe tax codes.
--
-- lib/services/checkout-pricing.ts requires tax_category to match
-- /^txcd_\d{8}$/ and throws "no valid tax classification" otherwise. Seed data
-- used the literal 'standard', which is present-but-invalid, so the
-- store.default_tax_code fallback never applied and every checkout was
-- rejected at the payment-intent step.
--
-- txcd_99999999 is Stripe's "General - Tangible Goods", the correct catch-all
-- for this physical catalog. Scoped to the legacy value only, so rows already
-- carrying a real Stripe code or NULL are untouched.

UPDATE products
   SET tax_category = 'txcd_99999999'
 WHERE tax_category = 'standard';

UPDATE product_variants
   SET tax_category = 'txcd_99999999'
 WHERE tax_category = 'standard';
