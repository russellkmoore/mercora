---
phase: 10-gift-card-purchase-flow
plan: 02
subsystem: storefront-cart-checkout
tags: [gift-card, react, rsc, react-tdd]
requires:
  - phase: 10-01
    provides: "GiftCardCustomization on the persisted cart line, written by the recipient form and normalizeCartItemForStore"
provides:
  - "components/gift-cards/GiftCardRecipientBlock.tsx: hook-free, client-directive-free presentational component rendering the To/Deliver/message lines in fixed order, with tone (default|inverse) and variant (compact|detail) props"
  - "exported const GIFT_CARD_MESSAGE_PREVIEW_LENGTH (80) and pure function truncateGiftCardMessage — code-point-safe truncation, directly unit-testable"
  - "CartItemCard.tsx and OrderItemCard.tsx switched onto the shared block, replacing their duplicated inline 'For ...' fragments"
affects: [10-03, 10-04, 10-05]

actuals:
  tokens: 2842
  tasks: 2
  commits: 4
  plan_head_before: 86c8dd2

tech-stack:
  added: []
  patterns:
    - "Code-point truncation via Array.from(message) rather than string.slice/length, so an astral character (emoji) at the boundary is never split into an unpaired surrogate"
    - "Orthogonal enumerated props (tone x variant) on one shared component instead of per-surface component copies — same pattern the codebase already uses elsewhere for per-surface differences"
    - "RED-phase scaffold-first TDD for a brand-new module: when the unit under test does not exist yet, the RED commit includes a minimal, deliberately-incomplete stub (exports present, behavior wrong) so the test module resolves and fails on real per-test assertions rather than a module-load crash — required for gsd_run check tdd-red-evidence to classify the run as RED_EVIDENCE_OK rather than INVALID_RED (fixture_or_load_failure)"
    - "vitest's default and --reporter=tap output nest subtests with leading whitespace, which the RED-evidence tool's TAP regexes (anchored at column 0, no node-test summary footer) cannot parse; --reporter=tap-flat produces column-0, fully-qualified test names, and the executor appends a synthesized '# tests/# pass/# fail' footer computed by counting the actual ok/not ok lines before building the evidence record"

key-files:
  created:
    - components/gift-cards/GiftCardRecipientBlock.tsx
    - tests/unit/components/gift-card-recipient-block-source.test.ts
  modified:
    - components/cart/CartItemCard.tsx
    - components/checkout/OrderItemCard.tsx
    - tests/unit/components/cart-line-source.test.ts

key-decisions:
  - "RED commits for both tasks include a minimal production scaffold (Task 1: the whole stub component; Task 2: none needed, since CartItemCard/OrderItemCard already existed) alongside the test file, documented inline in each RED commit message as scaffold-not-feature, so the RED phase produces real per-test assertion failures the tdd-red-evidence tool can classify as RED_EVIDENCE_OK instead of a module-load crash it would classify as INVALID_RED"
  - "Used vitest's tap-flat reporter (not the default tap reporter) plus a synthesized node-test-style summary footer to build each RED evidence record, since vitest's TAP output nests subtests and has no '# tests/# pass/# fail' footer, neither of which the tdd-red-evidence tool's parser recognises"

patterns-established:
  - "GiftCardRecipientBlock is the single source for the To/Deliver/message line order and the omit-when-absent rule across all SHOP-05 surfaces; the detail variant (text-sm, whitespace-pre-line, full untruncated message, no title attribute) lands unused in this plan for 10-04's account order page to consume as a pure caller change"

requirements-completed: [SHOP-05]

coverage:
  - id: D1
    description: "One shared presentational component renders the recipient block, and both the cart drawer line and the checkout order-summary line use it instead of their own inline text"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/cart-line-source.test.ts — 'CartItemCard imports GiftCardRecipientBlock and renders it with the inverse tone', 'OrderItemCard imports the same component and renders it without an explicit tone prop'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The block renders the To line, then Deliver, then message, in that fixed order regardless of which optional fields are present; optional fields absent means the line is omitted entirely, never rendering undefined or a dangling separator"
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "components/gift-cards/GiftCardRecipientBlock.tsx — three independently-guarded <p> elements in source order (to, deliveryDate, message), each conditionally rendered only when its field is present"
        status: pass
    human_judgment: false
  - id: D3
    description: "truncateGiftCardMessage truncates by code point (Array.from), not UTF-16 code unit, at exactly 80 code points with a single trailing ellipsis, never splitting an astral character into an unpaired surrogate; the compact message line carries a title attribute holding the full untruncated message"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "mise exec -- npx vitest run tests/unit/components/gift-card-recipient-block-source.test.ts -> 13 passed, including the 81-code-point boundary, the astral-boundary unpaired-surrogate check, the 100-emoji case, and the title-attribute source assertion"
        status: pass
    human_judgment: false
  - id: D4
    description: "The block has no hooks, no event handlers and no use client directive, so it imports cleanly into both client components and an async React Server Component"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-recipient-block-source.test.ts — 'opens with no client-component directive and imports nothing from react'; grep -c 'useState\\|useEffect\\|onClick' components/gift-cards/GiftCardRecipientBlock.tsx -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The cart drawer instance uses tone inverse (text-on-inverse / text-muted-on-inverse); the checkout instance uses the default tone (text-foreground / text-muted-foreground); both keep text-xs sizing matching the one-line text each replaces"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/cart-line-source.test.ts — tone=\"inverse\" assertion on CartItemCard, absence of any explicit tone prop on OrderItemCard; grep -c text-on-inverse/text-muted-on-inverse/text-foreground/text-muted-foreground component source -> 1 each"
        status: pass
    human_judgment: false
  - id: D6
    description: "The block reads only the four allowlisted GiftCardCustomization fields; no bearer code, redemption token or account identifier can reach any of these surfaces"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-recipient-block-source.test.ts — 'never references a bearer code or redemption token field'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Recipient details stay non-editable from the cart: the Remove button and its copy are unchanged and no edit affordance is added"
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "git diff on CartItemCard.tsx shows only the gift-card fragment replaced; Remove button block byte-identical (untouched hunk)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The block carries a second enumerated prop, variant (compact | detail), orthogonal to tone: compact is the cart/checkout treatment (text-xs, truncated message with the full text on title); detail is the account order-detail treatment (text-sm, whitespace-pre-line, full message, no truncation, no title) — landed here unused for plan 10-04"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "tests/unit/components/gift-card-recipient-block-source.test.ts — 'carries both variant wrapper classes', 'preserves newlines only on the detail variant, exactly once in the file', 'renders the detail variant with the raw message, not the truncation helper'"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every plan prohibition holds: no file under lib/gift-cards/ touched, no change to cart-store.ts/app/api/lib/services, no migration added, no new npm dependency, no hardcoded palette, every commit stages only its named files, no template code keys off the product id or slug"
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "git diff --stat -- lib/gift-cards app/api lib/services migrations package.json package-lock.json -> all empty; mise exec -- npm run scan:tokens -> 0 violations; grep -c prod_33 over the three component files -> 0"
        status: pass
    human_judgment: false
  - id: D10
    description: "Two cart lines for the same recipient at different denominations, and two cart lines for different recipients, each render as independent, non-shared, non-merged blocks reading only their own line's customization"
    requirement: "SHOP-05"
    verification:
      - kind: other
        ref: "GiftCardRecipientBlock is a pure props-in/JSX-out component with no module-level or shared state; each CartItemCard/OrderItemCard invocation passes its own item.giftCardCustomization, so two invocations are structurally independent by construction — no shared cache or memo exists to merge them"
        status: pass
    human_judgment: false
  - id: D11
    description: "Add two gift cards to the cart for the same recipient at two different denominations plus one physical item; in the cart drawer confirm two separate gift-card blocks in To/Deliver/message order, the physical line unchanged, and a long message shows an ellipsis with the full text on hover"
    requirement: "SHOP-05"
    verification:
      - kind: unit
        ref: "Automated portion of Task 2's verify block (unit tests, typecheck, lint, scan:tokens) re-run and passed before marking the task done"
        status: pass
    human_judgment: true
    rationale: "This is the plan's own <human-check> item (Task 2 verify block). HUMAN_VERIFY_MODE is end-of-phase (not auto mode), so per the executor contract this is recorded here for harvest at end-of-phase UAT rather than synthesizing a mid-plan checkpoint."

duration: 11min
completed: 2026-09-08
status: complete
---

# Phase 10 Plan 02: Shared Gift-Card Recipient Block Summary

**Extracted the cart drawer's and checkout order summary's duplicated inline "For ..." fragments into one hook-free, RSC-safe `GiftCardRecipientBlock` with a directly-testable, code-point-safe truncation helper and an orthogonal tone/variant prop pair.**

## Performance
- **Duration:** ~11 min
- **Tasks:** 2 (both `tdd="true"`, RED->GREEN)
- **Commits:** 4

## Accomplishments
- **Task 1:** Created `components/gift-cards/GiftCardRecipientBlock.tsx` (new file, new `components/gift-cards/` directory) exporting `GIFT_CARD_MESSAGE_PREVIEW_LENGTH` (80), the pure `truncateGiftCardMessage` function, `GiftCardRecipientBlockProps`, and the default-exported component. The component renders the To/Deliver/message lines in fixed order, resolves a `tone` (`default` | `inverse`) class pair and a `variant` (`compact` | `detail`) wrapper/message treatment, and carries no hook, handler, or client directive. `truncateGiftCardMessage` splits on `Array.from` (code points) rather than UTF-16 code units, so an emoji or other astral character at the 80-character boundary is never cut into an unpaired surrogate. 13 unit and source-contract assertions in `tests/unit/components/gift-card-recipient-block-source.test.ts` cover the truncation boundary cases (40-char unchanged, exactly-80 unchanged, 81-char truncated with ellipsis, astral-boundary safety, 100-emoji truncation, newline preservation) and the source contract (no client directive, no react import, both tone pairs, both variant classes, title-attribute wiring, single `whitespace-pre-line` occurrence, detail-variant raw-message rendering, no bearer-code/token field names).
- **Task 2:** Swapped `CartItemCard.tsx` and `OrderItemCard.tsx` onto the shared block. `CartItemCard.tsx` now renders `<GiftCardRecipientBlock customization={item.giftCardCustomization} tone="inverse" />` in place of its inline fragment, keeping the existing presence guard, price line, and Remove button unchanged. `OrderItemCard.tsx` renders the same component with no tone prop (default tone), keeping its guard and layout unchanged and adding no client directive. Extended `tests/unit/components/cart-line-source.test.ts` with a new describe block (4 new assertions) covering the import/tone wiring, the removal of the old inline fallback, and the survival of both presence guards; the four pre-existing assertions are untouched.

## Task Commits
1. **Task 1: Shared recipient block with code-point-safe truncation**
   - `test(10-02)` `a0d0a49` — RED: failing tests plus a minimal, deliberately-incomplete scaffold of the new component's exports (module must resolve for the RED-evidence tool to attribute failures to named tests rather than a module-load crash). 8/13 assertions fail against the stub. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` on the 81-code-point truncation target test.
   - `feat(10-02)` `582aea9` — GREEN: full implementation (truncation, tone resolution, variant resolution, fixed line order); fixed a test-authoring bug found while confirming GREEN (the "preserves newlines" fixture was 81 code points, crossing the truncation boundary it wasn't meant to test — corrected to exactly 80). All 13 assertions pass; typecheck and scan:tokens clean.
2. **Task 2: Switch cart and checkout order-summary lines onto the shared block**
   - `test(10-02)` `9bc1a7d` — RED: new describe block extending `cart-line-source.test.ts`, failing against the current inline-fragment source. 3/6 assertions fail (the guard-survival assertion already passes since the guard isn't changing). `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` on the CartItemCard import/tone target test.
   - `feat(10-02)` `76ffdbe` — GREEN: both call sites switched over. All 20 assertions across the three targeted test files pass; full `tests/unit/components/` (157 tests) and full `tests/unit/` (2272 tests) both green; typecheck, lint (0 errors), and scan:tokens (0 violations) clean; `git diff --stat` over `lib`, `components/checkout/CheckoutClient.tsx`, and `app/api` is empty.

## Files Created/Modified
- `components/gift-cards/GiftCardRecipientBlock.tsx` — new file, new `components/gift-cards/` directory; default export plus `GIFT_CARD_MESSAGE_PREVIEW_LENGTH` and `truncateGiftCardMessage`
- `tests/unit/components/gift-card-recipient-block-source.test.ts` — new file, 13 assertions
- `components/cart/CartItemCard.tsx` — inline gift-card fragment replaced with `<GiftCardRecipientBlock ... tone="inverse" />`
- `components/checkout/OrderItemCard.tsx` — inline gift-card fragment replaced with `<GiftCardRecipientBlock ... />` (default tone)
- `tests/unit/components/cart-line-source.test.ts` — extended with a new describe block (4 assertions), 4 pre-existing assertions untouched

## Decisions Made
- **RED-phase scaffold-first TDD for a brand-new module.** `GiftCardRecipientBlock.tsx` did not exist before Task 1, so a test importing it would crash at module resolution rather than fail on a real assertion — the `gsd_run check tdd-red-evidence` tool classifies a module-load crash as `INVALID_RED` (`fixture_or_load_failure`), which blocks GREEN. The RED commit therefore includes a minimal, explicitly-labeled stub (correct exports, deliberately wrong behavior) alongside the test file, so the module resolves and the tests fail on real per-test assertions. This is standard "declare the signature, then TDD the body" practice, documented inline in the RED commit message as scaffold, not feature.
- **`--reporter=tap-flat` plus a synthesized summary footer for RED evidence.** vitest's default and `--reporter=tap` output nest `describe`/`it` subtests with leading whitespace and never emit a `# tests`/`# pass`/`# fail` footer, both of which the RED-evidence tool's parser requires (it is built against `node --test`'s flat, footer-terminated TAP dialect). `--reporter=tap-flat` produces column-0, fully-qualified test names (`file.test.ts > describe > it`) that the parser can match; the footer is synthesized by counting the actual `ok`/`not ok` lines in that output before the record is built — an honest derivation of the real run, not fabricated data.

## Deviations from Plan
None beyond the RED-evidence tooling accommodation documented above under Decisions Made — the plan executed as written, including its append-only/prohibition constraints (no file under `lib/gift-cards/`, `app/api/`, `lib/services/`, or `migrations/` touched; no new npm dependency; no product-id/slug keying).

## Issues Encountered
- Fixed a self-authored test bug in Task 1's RED phase (the "preserves newlines" fixture unintentionally exceeded the 80-code-point cap, so its own truncation would have altered the message it claimed to leave unchanged) — corrected before the GREEN commit. Documented above and in the GREEN commit message.

## User Setup Required
None. No new environment variable, secret, or manual account setup is introduced by this plan.

## Next Phase Readiness
`GiftCardRecipientBlock` is proven end to end on two of the four SHOP-05 surfaces (cart drawer, checkout order summary) with its `detail` variant landed but unused. Plan 10-04 (account order detail page) can import it directly into the async Server Component with the RSC-safety contract already proven by the source-contract test, and Plan 10-03 (order confirmation modal) can reuse it at the default tone exactly as `OrderItemCard.tsx` does here. The Task 2 human-check item (two-gift-card visual verification in the live cart drawer) is recorded above for end-of-phase UAT harvest rather than blocking this plan.

## Self-Check: PASSED

- `components/gift-cards/GiftCardRecipientBlock.tsx` — FOUND
- `tests/unit/components/gift-card-recipient-block-source.test.ts` — FOUND
- `components/cart/CartItemCard.tsx` — FOUND, modified
- `components/checkout/OrderItemCard.tsx` — FOUND, modified
- `tests/unit/components/cart-line-source.test.ts` — FOUND, extended
- All 4 commit hashes above (`a0d0a49`, `582aea9`, `9bc1a7d`, `76ffdbe`) verified present in `git log --oneline --all`
- Re-ran plan `<verification>`: `mise exec -- npx vitest run tests/unit/components/` (157 passed), `mise exec -- npm run lint` (0 errors), `mise exec -- npm run typecheck` (clean), `mise exec -- npm run scan:tokens` (0 violations); `git diff --stat -- lib app/api migrations package.json package-lock.json` empty; neither `CartItemCard.tsx` nor `OrderItemCard.tsx` contains its old inline fallback
- Re-ran every acceptance criterion in Tasks 1-2 (grep checks, diff-empty checks) — all pass
- Full `tests/unit/` suite (2272 tests, 272 files) re-run green as an additional confidence check beyond the plan's own scope

---
*Phase: 10-gift-card-purchase-flow*
*Completed: 2026-09-08*
