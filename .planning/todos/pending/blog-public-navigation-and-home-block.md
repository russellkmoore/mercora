---
title: Surface the blog publicly — header navigation and a configurable home-page articles block
created: 2026-09-10
resolves_phase: null
source: Russell, 2026-09-10 (while testing gift-card checkout)
audit_acknowledged:
  milestone: v2.1
  at: 2026-09-10
---

# Blog: make it reachable and put it on the home page

## Today

- Admin can write and manage articles (`app/admin/blog`, `app/api/admin/blog`).
- The public side exists: `/blog` index, `/blog/[slug]`, `/blog/rss.xml`, and `app/api/blog`.
- The only public way in is a small "Blog" link in the footer ([Footer.tsx](../../../components/Footer.tsx)). Nothing in the header, no category/help navigation, nothing on the home page.

## Wanted

1. **Navigation.** A "Blog" (or configurable label, e.g. "Journal") entry in the header nav next to Categories / Help & Search, and in the mobile menu. Store-config driven so a storefront without articles hides it.
2. **Home-page block.** A configurable section on the home page rendering the latest N published articles as excerpts (title, cover image, date, first paragraph or explicit excerpt) with a "Read all" link to `/blog`. Configurable: enabled, heading, count, placement relative to the existing home sections. Same token classes as the rest of the storefront (`docs/theming.md`); no admin-palette leakage.
3. **Admin side.** The settings live under Admin → Settings (appearance or content), not hardcoded in the template — same rule as the gift card: no template hardcoding to data.

## Notes for planning

- Excerpt source: check whether articles already carry an excerpt/summary field; if not, derive from the first paragraph with a length cap and strip markup.
- Volt / vectorize: articles may already be indexed via `knowledge`/blog; confirm before adding a second index path.
- SEO: the home block should link, not duplicate, article content.
- Belongs in its own milestone (content/blog), not in the gift-card follow-ups.
