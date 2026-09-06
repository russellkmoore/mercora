# Live not-found pages return HTTP 200

Observed 2026-09-06 after the v2 deploy: `/no-such-page`, `/category/does-not-exist`, and
`/product/does-not-exist` on https://voltique.russellkmoore.me render the themed 404 page
(`app/not-found.tsx`) but respond with status 200 (`x-opennext: 1`, `cache-control: no-store`).
The routes call `notFound()`; the status is lost somewhere in the OpenNext/Workers layer.

Not known whether this predates v2 (no baseline was recorded). Check `npm run preview` locally,
then the `@opennextjs/cloudflare` issue tracker for not-found status handling. Matters for SEO and
for any monitor that keys on 404s.

## Resolution (2026-09-06)

Root cause: `app/loading.tsx` at the app root put every page behind a Suspense boundary, so
the shell streamed with 200 before `notFound()` ran (Next 16: streamed responses are always
200). Removed in commit a04e1ea; verified live after deploy: `/no-such-page`,
`/category/does-not-exist`, `/product/does-not-exist` all answer 404, real routes 200. The
behaviour predated v2 (the file dated from 2025-08-01).
