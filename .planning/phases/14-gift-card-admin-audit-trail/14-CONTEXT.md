# Phase 14: Gift-Card Admin & Audit Trail - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss. Russell was away; every grey area below took the recommended answer, and the decisions marked *(Claude, unattended)* are the ones to confirm at the milestone review.

<domain>
## Phase Boundary

An admin can find any gift card, read its whole history, and act on it: disable with a reason, reissue a disabled card's remaining balance as a new card, resend the delivery email, re-queue a `needs_review` delivery, release a stuck hold, add notes, and create a card by hand. Every human action lands in a new expand-only `gift_card_events` table and shows on one timeline beside the ledger, reservations and deliveries the backend already records. Codes stay hidden unless a documented setting turns on a confirm-gated reveal. Requirements GCA-01..09. Whether the admin entry renders at all is Phase 13's rule (D-10/D-17 there) and does not change here. The money semantics in ADR-CTB-10 do not change: every balance movement is still a ledger entry written through the existing guards.
</domain>

<decisions>
## Implementation Decisions

### Storage and the timeline
- **D-01:** Migration `0024_add_gift_card_events.sql` mirrors `0014_add_order_events.sql`: `id` TEXT PK, `gift_card_id` → `gift_card_accounts(id)` ON DELETE **RESTRICT** (the gift-card tables restrict throughout), `event_type` TEXT (free vocabulary, no CHECK, same as order events), `actor_type` TEXT CHECK IN ('admin','service','system'), `actor_id` TEXT NULL, `details` TEXT NULL CHECK (`json_valid` and `json_type = 'object'`), `created_at` INTEGER epoch seconds (the gift-card tables use integer epochs; do not copy order events' text timestamps). Indexes `(gift_card_id, created_at)` and `(event_type, created_at)`. A partial UNIQUE index on `(gift_card_id)` WHERE `event_type = 'reissued'` makes a second reissue of the same card impossible at the database. Drizzle table `giftCardEvents` in `lib/db/schema/gift-cards.ts`.
- **D-02:** The same migration adds `code_suffix TEXT NULL` (the last code group, 4 characters, uppercase) to `gift_card_accounts` via `ALTER TABLE ADD COLUMN`, populated at issuance from the plaintext the issuer already holds. It is display and search material only, not bearer material: `maskGiftCardCode` already prints it in customer email and checkout. Rows issued before 0024 show "—" and are not searchable by suffix; no backfill (the one production card is spent).
- **D-03:** Event vocabulary: `note`, `disabled`, `reissued` (on the old card, details `{ to_gift_card_id, amount_minor, recipient_email }`), `reissued_from` (on the new card, details `{ from_gift_card_id }`), `delivery_resent`, `delivery_requeued`, `hold_released`, `admin_created`, `code_revealed`. Details never contain a code, hash, ciphertext or nonce; a source-contract test pins the writer.
- **D-04:** The timeline is assembled at read time by `GET /api/admin/gift-cards/[id]/events`: ledger entries (issuance, redemption with order and amount, restoration, adjustment), reservations (hold, commit, release with reason, expiry), the delivery row's status history (created, sent, needs_review, requeued) and `gift_card_events`, merged and sorted by time, oldest first. No backfill of historical ledger rows into events. Response shape mirrors `app/api/admin/orders/[id]/events/route.ts`: `{ events: [{ id, type, actorType, actorId, actorLabel, details, createdAt }], meta }`, with `actorLabel` resolved from `admin_users` for admin actors and "order {id}" / "system" otherwise.

### Actions
- **D-05:** Disable: `repository.disableAccount(id, now)` sets `status = 'disabled'`, `disabled_at = now` (the 0022 transition trigger permits exactly this); reason required, 1–500 characters, stored on the `disabled` event. There is no re-enable (the trigger forbids disabled→active); the answer to "disabled by mistake" is reissue.
- **D-06:** Reissue *(Claude, unattended)*: allowed only on a **disabled** card with no open (uncommitted, unexpired) and no committed-unsettled reservation; otherwise 409 `gift_card_reissue_blocked` naming why. Amount = the old card's available balance. One transaction: an `adjustment` ledger entry of −amount on the old card (business key `gift-card-reissue-out/{oldId}`, the 0022 balance guard stops it going below zero), a new account issued through `issueAccount` for +amount with `issuance_business_key = gift-card-reissue/{oldId}`, the same currency, `issued_order_id` NULL, a delivery row addressed to the original recipient unless the admin typed another address, plus the paired `reissued` / `reissued_from` events. Both the UNIQUE business keys and the D-01 partial index make it once-only. The new card is delivered by the existing cron drain like a purchase.
- **D-07:** Admin-create: amount in minor units, 1 ≤ amount ≤ `STORE_GIFT_CARD_MAX_MINOR` if that constant exists, else the product's configured maximum denomination; recipient email (validated like checkout), optional recipient name, reason required. Issued through `issueAccount` with `issuance_business_key = gift-card-admin/{eventId}`, `purchaser_customer_id` NULL, `issued_order_id` NULL; event `admin_created { reason, amount_minor, recipient_email }`. The list shows purchaser as "admin: {display name}" when there is no order.
- **D-08:** Resend *(Claude, unattended)*: for a delivery in `sent` (or `needs_review`) state, decrypt the retained ciphertext and send the same delivery email now, with idempotency key `gift-card-resend/{deliveryId}/{eventId}` so the sender's dedupe does not swallow it; the delivery row is not modified; event `delivery_resent { to }`. The admin may type a different address (fraud recovery); the address goes on the event, never on the delivery row.
- **D-09:** Re-queue: only from `needs_review`; one UPDATE sets `status = 'pending'`, `completed_at = NULL`, `attempt_count = 0`, `deliver_after = now`, `claim_token = NULL`, `lease_expires_at = NULL` (the 0022 CHECKs require all of these together); event `delivery_requeued`. The cron drain picks it up.
- **D-10:** Release a hold: only an uncommitted, unreleased reservation (the transition trigger rejects anything else); `releaseReservation` with reason `admin:{userId}` (fits the 200-char reason CHECK); event `hold_released { reservation_id, amount_minor }`. Committed-unsettled reservations are not releasable here; the timeline shows them as "awaiting settlement".
- **D-11:** Notes: 1–2000 characters, event `note { text }`, actor = the admin's Clerk user id; the timeline shows the admin's display name from `admin_users`.
- **D-12:** Code reveal *(Claude, unattended)*: **off by default.** Setting `gift_cards.code_reveal_enabled` (boolean, category `gift_cards`, declared in `defaultSettings` with a description, documented in `docs/runtime-configuration.md` under the admin settings list). When on, `POST /api/admin/gift-cards/[id]/reveal` with body `{ confirm: true }` requires a **super admin** session (`isSuperAdminActor`; service tokens and dev bypass refused), decrypts the retained ciphertext, returns the code once in the response body (never logged, never in telemetry), and writes `code_revealed` first — if the event write fails the code is not returned. The UI shows a confirm dialog that names the audit consequence. Cards whose delivery has no ciphertext return 409 `code_unavailable`.

### API and safety
- **D-13:** Routes: `GET /api/admin/gift-cards` (list + search), `POST /api/admin/gift-cards` (admin-create), `GET /api/admin/gift-cards/[id]` (detail), `GET .../[id]/events`, `POST .../[id]/disable`, `.../reissue`, `.../resend`, `.../requeue`, `.../release-hold` (body `{ reservationId }`), `.../notes`, `.../reveal`. Every handler starts with `checkAdminPermissions` (same-origin is already enforced for POST there), uses the `actorFrom(auth)` pattern from the ship route, size-limited JSON parsing (413/400), and typed error codes (400 invalid_body, 401 unauthorized, 404 gift_card_not_found / gift_cards_unavailable, 409 with a specific code, 503 gift_cards_write_failed).
- **D-14:** No admin response ever carries `code_hash`, `code_ciphertext`, `code_nonce`, `code_key_version`, `claim_token`, `email_idempotency_key` or ledger business keys. The presentations header in `lib/gift-cards/presentations.ts` is revised to say account **ids** are included (the detail link needs them) while code material stays out; a source-contract test greps the projection files and the route files for the forbidden column names.
- **D-15:** Search: one query parameter `q`; the server matches it, in order, as an exact order id, an exact recipient email (case-insensitive, against the delivery row), or an exact four-character code suffix (case-insensitive, against `code_suffix`). Status filter and limit/offset pagination stay; the response adds `meta.total` and the UI renders Prev/Next.
- **D-16:** The Phase 13 honor-guard contracts are honoured: nothing in this phase writes `admin_settings` except the existing generic settings route (the reveal setting is flipped there like any other setting); `resolveHonorEffective` stays the only owner of the 404 decision for the admin page and API, and the new detail page and routes call it the same way `app/admin/gift-cards/page.tsx` does.

### UI
- **D-17:** Admin UI keeps the admin palette (excluded from the token contract by design). List page: `components/admin/GiftCardQueue.tsx` becomes a real list — search box, status filter, "Create card" button opening a dialog, table columns per GCA-01 (masked code from `code_suffix`, issued amount, available balance, status, purchaser or "admin: name", recipient email, issuing order link, delivery status, created), each row linking to `/admin/gift-cards/[id]`. Detail page: client component modelled on `app/admin/orders/[id]/page.tsx` — header card, action bar (Disable, Reissue, Resend, Re-queue, Release hold, Reveal when enabled), a note form, the timeline. Confirm dialogs for disable, reissue, release and reveal; sonner toasts for outcomes; loading and error states as the orders page does them.
- **D-18:** UI-SPEC skipped (planning runs with `--skip-ui`), same call as Phases 9, 12 and 13: the admin dashboard is outside the token contract and the orders detail page is the pattern to copy.

### Claude's Discretion
- Exact copy for confirm dialogs and timeline entry labels.
- Whether the timeline merge lives in `lib/gift-cards/timeline.ts` (recommended) or inside the route.
- Test shape: D1 integration tests for disable/reissue/requeue/release/create against the real triggers (the reissue once-only guard must be proven by a second attempt failing), unit tests on the route handlers with mocked repository, source contracts for the forbidden-column rule and the events writer, and a `0024` migration-ordering test in the style of `tests/integration/gift-cards-migration.test.ts`.
</decisions>

<specifics>
## Specific Ideas

- Russell: "I can't see the number, I can't invalidate it and create a new one, I can't see the recipient, etc. this admin panel is next to useless." The list must answer "which card is this, who has it, what is left on it" at a glance.
- Russell: fraud in gift-card creation must be answerable by invalidating individual cards, with an audit trail: purchase data, order number, admin-created by whom, used data/order number, invalidation date and by whom, and CSR notes.
- "Seeing the code" was left as a decision for this phase; D-12 answers it: masked by default, confirm-gated reveal behind a documented setting that is off.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data and money
- `migrations/0022_add_gift_cards.sql` — every trigger this phase must live within (status transition :83, identity immutability :63, ledger append-only :333/:341, balance guard :255, entry-type consistency :269–:308, reservation transition :174, delivery CHECKs :386–:439)
- `migrations/0014_add_order_events.sql`, `lib/db/schema/order-events.ts` — the events table shape to mirror
- `lib/db/schema/gift-cards.ts` — Drizzle tables; add `giftCardEvents` and `code_suffix`
- `lib/gift-cards/repository.ts` — `issueAccount`, `readBalance`, `releaseReservation`, `restoreRedemption`, `sumOutstandingGiftCardBalances`; add `disableAccount`, `listAccounts`/search, `findReservations`, `writeAdjustment` (or fold into a `reissue` transaction)
- `lib/gift-cards/domain.ts` — business-key helpers and assertion helpers
- `lib/gift-cards/encryption.ts`, `lib/gift-cards/config.ts` — `decryptGiftCardDeliveryCode` and the delivery key ring (for resend and reveal)
- `lib/gift-cards/code.ts` — `maskGiftCardCode`, `giftCardLookupCandidates`

### Delivery and email
- `lib/services/gift-card-fulfillment.ts` — `deliveryMessage`, `deliverOne`, `drainGiftCardDeliveries`; resend reuses `deliveryMessage`
- `lib/email/sender.ts` — `sendEmail(message, { idempotencyKey, env })`

### Admin patterns
- `app/api/admin/orders/[id]/ship/route.ts` — mutation route template (`checkAdminPermissions`, `actorFrom`, size-limited JSON, typed codes)
- `app/api/admin/orders/[id]/events/route.ts` — timeline response shape and `admin_users` label join
- `app/admin/orders/[id]/page.tsx` — detail page pattern
- `lib/auth/admin-middleware.ts` — `checkAdminPermissions`, `isSuperAdminActor`
- `lib/db/schema/settings.ts` `defaultSettings`, `lib/utils/settings.ts` `getSettings` — the reveal setting
- `app/admin/gift-cards/page.tsx`, `app/api/admin/gift-cards/route.ts`, `components/admin/GiftCardQueue.tsx`, `lib/gift-cards/presentations.ts` — what exists today
- `lib/gift-cards/honor-guard.ts` and its source contracts (`tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts`, `admin-settings-writer-source.test.ts`, the ownership contract) — must stay green

### Locked
- `docs/checkout-trust-boundary.md` (ADR-CTB, ADR-CTB-10) — no change to reservation, commit, settle, restore semantics
- `docs/database-migrations.md` — expand-only; next number is `0024`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `issueAccount` already creates the account, the issuance ledger entry and the delivery row in one go; admin-create and reissue are new callers, not new code paths.
- The `adjustment` ledger entry type exists in 0022 with no order/reservation constraints — the vehicle for draining a reissued card.
- Ciphertext is retained after send (nothing nulls it), so resend and reveal need no new storage.
- `giftCardLookupCandidates` gives hash candidates across key versions if a future "search by full code" is wanted; this phase searches by suffix only.
- Order events route + `admin_users` join = the timeline API pattern.

### Established Patterns
- Admin mutation routes: `checkAdminPermissions` → actor → bounded JSON → typed status codes.
- D1 integration tests apply all migrations from `env.TEST_MIGRATIONS`, use a fixed epoch, and insert a pending order to satisfy FKs.
- Source-contract tests pin forbidden imports/columns by grepping files.

### Integration Points
- `app/admin/gift-cards/page.tsx` renders the list; the detail page is a new route under it, gated the same way.
- The Phase 13 admin layout server gate (`checkAdminSession`) already protects the new page's server render.
- `drainGiftCardDeliveries` delivers reissued and admin-created cards without change.
</code_context>

<deferred>
## Deferred Ideas

- Two migrations share number `0023` (`0023_add_order_effects_payload.sql`, `0023_normalize_tax_category_codes.sql`); both are applied in production and sort deterministically, but the collision should be recorded and the `check:migrations` gate taught to refuse duplicates — logged as a Phase 18 tech-debt todo.
- Full-code search (hash candidates) — not needed while suffix search exists.
- Bulk actions and CSV export.
- Customer-facing "my gift cards" — removed on purpose in v2.1 (SHOP-07 withdrawn); not coming back.
</deferred>

---

*Phase: 14-gift-card-admin-audit-trail*
*Context gathered: 2026-09-10 autonomously; decisions marked (Claude, unattended) await Russell's confirmation*
