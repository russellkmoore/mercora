# Mobile Lighthouse Baseline

**Status:** Baseline recorded; all four measured routes fail the PRD target
**Measurement date:** 2026-09-02
**Measured by:** GSD executor (Phase 2, plan 02-05, MOB-01)

## Method

Each route was measured with Lighthouse 13.4.1 (`npx --yes lighthouse@13.4.1`,
transient — not installed as a project dependency) against production, using:

```
lighthouse "<url>" \
  --form-factor=mobile --screenEmulation.mobile \
  --only-categories=performance \
  --output=json --output-path="<scratch-file>.json" \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet
```

Chrome was `HeadlessChrome/152.0.0.0` (from `environment.hostUserAgent` in the
raw reports), launched locally via `CHROME_PATH=/Applications/Google
Chrome.app/Contents/MacOS/Google Chrome`. Mobile form factor with Lighthouse's
default mobile throttling was used throughout — no throttling override was
passed, so the PRD's mobile-emulation target of 85 is being compared
apples-to-apples.

Each route was measured **three times**. Every metric below (Performance,
LCP, CLS, TBT) is the **median of its own three raw values independently** —
sort ascending, take the middle — never a mean and never the best run. The
run spread section below shows the three raw performance scores per route.

No raw Lighthouse JSON report is committed to this repository; all twelve
reports were written to a `mktemp`-style scratch directory outside the
working tree and are not referenced here by path.

### URLs measured

The category and product URLs were discovered from a single fetch of the
live sitemap, `https://voltique.russellkmoore.me/sitemap.xml` (HTTP 200).
The first `<loc>` under the category segment and the first under the product
segment, in document order, were:

- Category slug: **`featured`**
- Product slug: **`vivid-mission-pack`**

**Sitemap domain note:** the live sitemap's `<loc>` entries are all rendered
under `https://mercora.example.com` (the default `site` value in
`lib/store-config.ts:103`), not the real production host
`https://voltique.russellkmoore.me`. This is a pre-existing store-config
default and is out of scope for this plan (no source file is modified here).
The two slugs above were taken from the sitemap as discovered; the actual
Lighthouse measurements below were run against the real production host with
those slugs substituted in (e.g. `https://voltique.russellkmoore.me/category/featured`),
since measuring `mercora.example.com` would not describe the live storefront.

The four URLs actually measured:

| Route | URL |
| --- | --- |
| home | `https://voltique.russellkmoore.me/` |
| category | `https://voltique.russellkmoore.me/category/featured` |
| product | `https://voltique.russellkmoore.me/product/vivid-mission-pack` |
| checkout | `https://voltique.russellkmoore.me/checkout` |

All four returned `HTTP 200` with no redirect (checked via `curl -sI` before
measuring). No two URLs collided on a final destination.

## Results

PRD target: performance score **>= 85** to pass; **90+** is the stretch
target. LCP and TBT are in whole milliseconds; CLS to three decimal places.

| Route | URL | Performance | LCP (ms) | CLS | TBT (ms) | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| /home | `https://voltique.russellkmoore.me/` | 72 | 4864 | 0.013 | 233 | fail |
| /category/featured | `https://voltique.russellkmoore.me/category/featured` | 72 | 4548 | 0.178 | 140 | fail |
| /product/vivid-mission-pack | `https://voltique.russellkmoore.me/product/vivid-mission-pack` | 80 | 4588 | 0.000 | 128 | fail |
| /checkout | `https://voltique.russellkmoore.me/checkout` | 73 | 5299 | 0.013 | 143 | fail |

No route clears the PRD target of 85, and none clears the 90 stretch target.
The product page is closest at 80.

## Run spread

Raw performance scores per route, in run order (not sorted), so a reader can
see whether the reported median rests on tight runs or on an outlier:

| Route | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| home | 49 | 72 | 73 | 72 |
| category | 72 | 74 | 60 | 72 |
| product | 78 | 80 | 84 | 80 |
| checkout | 63 | 79 | 73 | 73 |

The home route's first run (49) is a clear outlier against its second and
third runs (72, 73); the median of 72 correctly ignores it rather than
averaging it in. The checkout route's spread (63/79/73) is similarly wide —
production Lighthouse runs on a live, uncached edge are noisy, which is
exactly why the median-of-three rule exists rather than reporting a single
run.

## Notes

- **`/checkout` served a real page, not a redirect.** With no cart populated
  (a fresh, cookie-less Lighthouse session), the checkout route returned
  `HTTP 200` directly rather than redirecting to cart or home. The reported
  checkout figures above describe that empty-cart checkout page, not a
  populated checkout flow — there was no redirect target to record.
- **No URL collision.** All four measured URLs resolved to distinct final
  destinations; none needed to be recorded as a collision.
- **Sitemap domain mismatch**, described under Method above: the live
  sitemap's `<loc>` values use `https://mercora.example.com` instead of the
  real production host. The category and product slugs were taken from the
  sitemap as discovered and re-based onto the real host for measurement. No
  source file was changed to fix this — it is a pre-existing store-config
  default (`lib/store-config.ts:103`) outside this plan's file list.
- **Sample size caveat.** A three-run median per route is enough to avoid a
  single lucky or unlucky run setting the baseline, but it is still a small
  sample against a noisy live edge target (see the home and checkout spreads
  above). Treat these numbers as directionally accurate, not exact.

## What this baseline is for

This is a **point-in-time measurement of production**, not a CI gate. It
exists to close MOB-01: before this document, nobody knew whether the live
site cleared the PRD's mobile performance target on any route. It now shows
that none of the four measured routes do, with home, category, and checkout
all in the low-to-mid 70s and product highest at 80.

Two follow-ons, neither performed by this plan:

- **Phase 4 REF-04** ticks the measurement checkboxes in
  `docs/mobile-improvements-actionable.md` now that this baseline exists.
- **`REQ-mobile-test-automation`** (backlog) covers turning this one-time
  measurement into automated Lighthouse CI, per
  `docs/mobile-testing-automation.md`.

---
*Measured: 2026-09-02*
