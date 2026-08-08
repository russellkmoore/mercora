-- Add the fulfillment-owned carrier column and defensively recover legacy data.
--
-- Legacy stores may have written carrier text to extensions.carrier. The
-- application also tolerated a double-encoded extensions object, so every JSON
-- read below is gated before it is parsed. Unknown non-empty carrier text is
-- retained: the runtime carrier registry, rather than this migration, owns the
-- set of valid carrier codes and aliases.

ALTER TABLE orders ADD COLUMN shipping_carrier TEXT;

-- Prefer extensions.carrier, the legacy admin write target. Keep the original
-- extension in place as a lossless recovery source.
UPDATE orders
SET shipping_carrier = CASE
  WHEN json_valid(extensions) THEN
    CASE
      WHEN json_type(extensions, '$.carrier') = 'text'
        THEN json_extract(extensions, '$.carrier')
      WHEN json_type(extensions) = 'text'
        THEN CASE
          WHEN json_valid(json_extract(extensions, '$'))
            THEN CASE
              WHEN json_type(json_extract(extensions, '$'), '$.carrier') = 'text'
                THEN json_extract(json_extract(extensions, '$'), '$.carrier')
            END
        END
    END
END
WHERE shipping_carrier IS NULL;

-- Canonicalize the built-in aliases used by the default registry. Preserve
-- unknown text so a store-supplied registry can still recognize it later.
UPDATE orders
SET shipping_carrier = CASE
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') = ''
    THEN NULL
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'usps%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedstatespostalservice%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'uspostalservice%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'ups%'
    THEN 'ups'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedparcel%'
    THEN 'ups'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'fedex%'
    THEN 'fedex'
  WHEN replace(replace(replace(replace(lower(trim(shipping_carrier)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'federalexpress%'
    THEN 'fedex'
  ELSE trim(shipping_carrier)
END
WHERE shipping_carrier IS NOT NULL;

-- shipping_method normally contains service levels such as "standard". Only
-- use it as a fallback when it clearly names a built-in carrier.
UPDATE orders
SET shipping_carrier = CASE
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'usps%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedstatespostalservice%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'uspostalservice%'
    THEN 'usps'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'ups%'
    THEN 'ups'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedparcel%'
    THEN 'ups'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'fedex%'
    THEN 'fedex'
  WHEN replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'federalexpress%'
    THEN 'fedex'
END
WHERE shipping_carrier IS NULL
  AND shipping_method IS NOT NULL
  AND (
       replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'usps%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedstatespostalservice%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'uspostalservice%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'ups%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'unitedparcel%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'fedex%'
    OR replace(replace(replace(replace(lower(trim(shipping_method)), ' ', ''), '.', ''), '-', ''), '_', '') LIKE 'federalexpress%'
  );
