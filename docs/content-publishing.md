# Content publishing

Mercora provides store-neutral CMS pages and Blog publishing. Migration `0019`
adds the Blog tables and neutral page-template registrations without seeding
merchant posts, pages, images, or copy.

## Public CMS API

`GET /api/pages` returns bounded `PublicPageSummary` records for navigation and
discovery. Page bodies and custom CSS are available from the published,
unprotected detail endpoint. Public responses never include stored custom
JavaScript, actor IDs, access roles, or version internals.

## Blog images

Admin Blog uploads use the shared, signature-checked R2 upload route. Configure
`NEXT_PUBLIC_IMAGE_CDN` to publish absolute cover-image URLs in social metadata
and rendered pages. A storefront `/media/` proxy is not part of this feature; installations
without an image CDN should treat uploaded R2 keys as unavailable to public
social crawlers until a media-delivery route is configured.

## Deployment and rollback

Apply migration `0019` before deploying the publishing code. The migration is
expand-only, existing CMS rows are not rewritten, and empty Blog tables are a
valid starting state. Rollback means deploying the prior application version
and leaving the added tables and template rows in place; do not down-migrate
merchant content.
