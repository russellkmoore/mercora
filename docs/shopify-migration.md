# Shopify migration toolkit

The operator-only Shopify migration toolkit imports catalog, content, media, customers, historical orders, and optionally Judge.me reviews into Mercora. It defaults to a local dry run. A dry run extracts and transforms data, resolves the named Wrangler targets, and builds the complete D1 plan without constructing R2, Clerk, or D1 write adapters.

The toolkit is deliberately fail-fast between phases. An apply validates deterministic source transforms before it obtains write adapters, then executes in this order:

1. verify and persist Shopify media to the Wrangler `MEDIA` R2 bucket;
2. resolve existing Clerk identities and, only when separately authorized, create source-verified customer identities;
3. rebuild the identity-dependent order/review plan, run the D1 schema preflight, apply dependency-ordered chunks, and validate the result.

It does not deploy Mercora, create Cloudflare resources, migrate schemas, obtain credentials, send email, or change Shopify/Judge.me.

## Prerequisites

- Node 24 and the repository dependencies installed locally.
- Mercora database migrations `0001` through `0020` already applied to the selected D1 database.
- A reviewed `wrangler.jsonc` with exactly one canonical `DB` binding and one canonical `MEDIA` binding for the selected environment. Use `MIGRATION_DATABASE_NAME` or `--expected-database-name` to pin the expected D1 name.
- A stable inventory location ID, page/blog actor ID, fallback blog author, ISO-4217 currency, fulfillment type, and unresolved-customer policy chosen by the merchant.
- An operator-created private input directory. Never place exports in the repository or a web-served directory.
- For API extraction, an exact `https://{shop}.myshopify.com` origin, a pinned quarterly Admin API version, and a read-only Shopify access token scoped only to the resources being migrated.
- For apply, Cloudflare R2 S3 credentials limited to the target bucket and the existing local Wrangler authentication/configuration needed by the D1 runner.

Run Mercora's normal tests and deployment preflight before beginning. Confirm the selected Wrangler environment and binding names independently; the migration refuses ambiguous or mismatched targets, but an operator is still responsible for selecting the intended account.

## Private input layout

File mode accepts JSON or CSV files with these basenames. Provide an empty array for a resource with no records so a missing export is not mistaken for an empty export.

```text
private-shopify-export/
  custom_collections.json
  smart_collections.json
  collects.json
  products.json
  pages.json
  blogs.json
  articles.json
  redirects.json
  customers.json             # only with sensitive import
  orders.json                # only with sensitive import
  judge-me-reviews.csv       # optional, sensitive
  review-attributions.json   # optional, sensitive
  verified-purchases.json    # optional, sensitive
```

API mode reads collections, collects, products, pages, blogs/articles, redirects, and—when confirmed—customers and all order statuses. Judge.me remains a bounded local CSV input, so API mode also needs `MIGRATION_INPUT_ROOT` when `JUDGE_ME_FILE` is set.

Review attribution files are JSON arrays. Every item contains a `reviewFingerprint` plus the final Mercora `productId`, historical `orderId`, Clerk `customerId`, and optional `orderItemId`. Verified-purchase rows contain the same identifiers and `verified: true`. The toolkit rejects missing, duplicate, synthetic, or contradictory attribution rather than inventing purchase history.

## Required configuration

Use environment variables for values and secrets; command-line flags are available for non-secret migration decisions.

```text
MIGRATION_INPUT_ROOT=/absolute/private/input
MIGRATION_CURRENCY=USD
MIGRATION_INVENTORY_LOCATION_ID=main
MIGRATION_FULFILLMENT_TYPE=physical
MIGRATION_ACTOR_ID=user_operator
MIGRATION_FALLBACK_AUTHOR=Store team
MIGRATION_MEDIA_HOSTS=cdn.shopify.com,store.myshopify.com
MIGRATION_UNRESOLVED_CUSTOMER=reject
MIGRATION_DATABASE_NAME=mercora-db
```

Allowed fulfillment values are `physical`, `digital`, and `service`. The unresolved-customer policy must explicitly be `reject` or `guest`; `reject` is the safer default for historical orders.

`MIGRATION_MEDIA_HOSTS` is an explicit allowlist, but it cannot broaden the toolkit's trust boundary. Media is accepted only from exact Shopify-owned asset hosts: `cdn.shopify.com`, or an exact `*.myshopify.com` host with a `/cdn/` path. Arbitrary custom CDNs are intentionally unsupported. Inline external images that fail this policy are removed from imported HTML.

API mode additionally requires:

```text
MIGRATION_SOURCE_MODE=api
SHOPIFY_STORE_URL=https://store.myshopify.com
SHOPIFY_ACCESS_TOKEN=private-read-token
SHOPIFY_API_VERSION=2026-07
```

Apply-only R2 credentials are read from `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Clerk uses `CLERK_SECRET_KEY`. Secrets are never accepted as command-line flags, written to the manifest, or admitted into structured logs.

## Dry run

Dry run is the default:

```sh
npm run migrate:shopify
```

The single JSON report written to stdout is non-authoritative and contains only target labels, aggregate counts, and phase results. It does not contain source records, customer fields, order data, emails, addresses, raw provider IDs, or credentials. A dry run does not write a manifest file and does not construct or call R2, Clerk, or D1 write adapters.

Review every skipped and warning count. The detailed transform code uses one-way source fingerprints in operational warnings; source payloads are never logged. Fix or deliberately accept the source condition before applying. Re-run the same dry run after every export or configuration change.

## Sensitive data and Clerk

Customers, orders, and Judge.me inputs require both flags:

```sh
npm run migrate:shopify -- --include-sensitive --confirm-sensitive-data
```

This confirmation permits the process to read customer names, email addresses, phone/address fields, historical orders, and review attribution. It does not authorize identity creation.

During apply, existing Clerk users are resolved only by an exact migration external ID. An email lookup detects ownership conflicts but never silently links an unrelated identity. Customers without a resolved Clerk identity are reconciled or skipped according to the downstream policy.

Clerk's backend `createUser` operation treats supplied email addresses as verified. Creation is therefore disabled unless all of these are present:

```text
--apply
--include-sensitive
--confirm-sensitive-data
--create-clerk-users
--confirm-clerk-auto-verification
```

Even then, the toolkit creates an identity only when Shopify marked the source email verified. It does not send an invitation, create a password, or auto-link by email. The operator must review Clerk reconciliation counts before treating the migration as complete.

Judge.me is enabled with `--judge-me-file=judge-me-reviews.csv`. Add `--review-attributions=review-attributions.json` and, if available, `--verified-purchases=verified-purchases.json`. A review without real matching product, order, Clerk customer, and optional line-item attribution is skipped. Historical Shopify payments remain non-authoritative and are never imported as Mercora-paid effects.

## Apply targets

Local apply requires `--apply`. Remote targets also require an explicit target and matching confirmation:

```sh
npm run migrate:shopify -- --apply --target=local
npm run migrate:shopify -- --apply --target=preview --confirm-preview
MERCORA_ALLOW_PRODUCTION_IMPORTS=1 npm run migrate:shopify -- --apply --target=production --confirm-production
```

Use `--env=<wrangler-environment>` when the reviewed bindings live in a named Wrangler environment. Production's environment variable is an additional circuit breaker, not a substitute for the target and confirmation flags.

Existing merchant rows are compare-only by default. A semantic mismatch aborts instead of overwriting merchant changes. Overwrite mode requires both `--overwrite` and `--confirm-overwrite`; use it only after reviewing the exact conflict and taking a backup.

For an apply report written as a private atomic `0600` file, set `MIGRATION_OUTPUT_ROOT` to a private existing directory. The resulting `manifest.json` contains aggregate counts only. Export files, attribution files, SQL chunks, logs, ID maps, and manifests are ignored by the repository's migration artifact rules, but operators must still verify they are not staged or uploaded.

## Deployment order

1. Merge and deploy a Mercora release that includes migration `0020`, `/media/*` object serving, and exact legacy redirect lookup.
2. Apply all Mercora migrations to the chosen D1 target and verify the normal deployment preflight.
3. Take and verify an independent D1 backup using the current Wrangler D1 export workflow. Record the target database and bucket outside the repository.
4. Run the complete migration as a dry run against the same target selection.
5. Apply to local or preview, verify catalog/content pages, media headers, customer/order visibility, and exact legacy URLs.
6. Repeat the dry run immediately before production, then run the separately confirmed production apply.
7. Retain the private source exports, reviewed report, backup, and reconciliation list according to the merchant's data-retention policy.

R2 is applied before D1 so imported rows never intentionally reference media that has not been cryptographically verified as written or already identical. Clerk precedes customer/order D1 rows because Mercora customer primary keys must be final `user_*` IDs.

## Resuming and rerunning

Transforms use deterministic provider fingerprints and target IDs. Media writes use conditional creation and verify existing object metadata/content hashes. Clerk uses the source fingerprint as its external identity. D1 inserts compare existing content unless overwrite was separately confirmed. Consequently, the supported resume procedure is to correct the failed prerequisite and rerun the same inputs and options from the beginning.

Do not edit a manifest to force progress and do not treat it as an authoritative checkpoint. If source exports or domain decisions change, start with a new dry run and review the new counts.

## Disable and rollback

There is no automatic cross-service rollback: R2, Clerk, and chunked D1 operations cannot share one transaction. Before production, maintain a verified D1 backup and a reviewed list of the target resources.

If an apply fails before D1, no imported storefront rows should be active; retain media objects and Clerk reconciliation state until the cause is understood, then rerun. Do not automatically delete Clerk users because they may have become real account identities.

If D1 has begun, stop further applies and storefront deployment changes. Restore the verified D1 backup or remove only fingerprint-proven imported rows in reverse dependency order under a separately reviewed recovery plan. Exact legacy redirects can be disabled by removing only their imported `redirect_map` rows. R2 objects are inert when no D1 content references their `/media/*` paths and can be removed later from the recorded import key set. Rotate or revoke the temporary Shopify/R2 credentials after the migration window.

## Media validation boundary

The downloader bounds redirects, DNS destinations, response time, declared/streamed bytes, and accepted content types. It parses JPEG marker structure, PNG chunks, and WebP RIFF/image payload structure before upload. This is structural validation, not a full pixel decode, image repair, transcoding, malware scanner, or visual review. A structurally valid file can still be undesirable or fail a downstream decoder. Preview every imported image and use an independent media-scanning/decoding workflow when the merchant's risk profile requires it.
