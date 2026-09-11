# Phase 14: Gift-Card Admin & Audit Trail - Research

**Researched:** 2026-09-10
**Domain:** Admin CRUD/audit surface over an existing, trigger-guarded D1 money ledger (gift cards); Next.js admin routes; Drizzle/raw-D1 hybrid repository; AES-GCM delivery-code encryption; provider-neutral idempotent email.
**Confidence:** HIGH — every claim below with a `[VERIFIED: path:line]` tag was read from the file this session; the phase's own repository, migration, and route code are small and fully legible.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
D-01 through D-18, copied verbatim from `.planning/phases/14-gift-card-admin-audit-trail/14-CONTEXT.md` `## Implementation Decisions` (Storage/timeline D-01..D-04; Actions D-05..D-12; API/safety D-13..D-16; UI D-17..D-18). Two of these decisions (D-06/D-07's business-key mechanism, and D-16's "flip the reveal setting through the existing generic settings route") are contradicted by code read this session — see Pitfalls 1 and 2 below. The rest of the decision set is directly supported by the verified code and should be treated as locked.

### Claude's Discretion
- Exact copy for confirm dialogs and timeline entry labels.
- Whether the timeline merge lives in `lib/gift-cards/timeline.ts` (recommended) or inside the route.
- Test shape: D1 integration tests for disable/reissue/requeue/release/create against the real triggers (the reissue once-only guard must be proven by a second attempt failing), unit tests on the route handlers with mocked repository, source contracts for the forbidden-column rule and the events writer, and a `0024` migration-ordering test in the style of `tests/integration/gift-cards-migration.test.ts`.

### Deferred Ideas (OUT OF SCOPE)
- Two migrations share number `0023` (`0023_add_order_effects_payload.sql`, `0023_normalize_tax_category_codes.sql`); both are applied in production and sort deterministically, but the collision should be recorded and the `check:migrations` gate taught to refuse duplicates — logged as a Phase 18 tech-debt todo.
- Full-code search (hash candidates) — not needed while suffix search exists.
- Bulk actions and CSV export.
- Customer-facing "my gift cards" — removed on purpose in v2.1 (SHOP-07 withdrawn); not coming back.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GCA-01 | `/admin/gift-cards` lists cards with masked code, issued amount, available balance, status, purchaser (or "admin: who"), recipient email, issuing order, delivery status, created date; searchable by recipient email, order id, last four; paginated | `lib/gift-cards/presentations.ts` read in full (current projection lacks `id`, `code_suffix`, `recipient_email`, purchaser label — all additions scoped in Architecture Patterns/Pitfall 6); search-param pattern in `app/api/admin/gift-cards/route.ts` to extend with `q=` |
| GCA-02 | Card detail page shows one timeline: issuance/admin-creation, every hold/release, every redemption, refunds, disable/reissue events, notes, each naming who/when | `app/api/admin/orders/[id]/events/route.ts` read in full as the shape to mirror; `admin_users` join pattern for actor labels; Pattern 3 (event-append) and the timeline-merge architecture diagram |
| GCA-03 | Admin can add a free-text note (author + timestamp recorded) | Pattern 3 (`appendGiftCardEvent`); `Actor`/`ActorType` reuse from `lib/fulfillment/types.ts` |
| GCA-04 | Admin can disable a card with a reason; ledger preserved; on timeline | 0022 `gift_card_accounts_status_transition_guard` and `gift_card_accounts_identity_immutable` triggers read and quoted verbatim (Code Examples); confirms the exact UPDATE shape that passes |
| GCA-05 | Admin can reissue a disabled card: new card for remaining balance, emailed, timelines link | `writeAdjustment`/reissue design (Pattern 1); Pitfall 2 (business-key contradiction) and Assumptions A2/A3 (batch atomicity) directly scope this requirement's risk |
| GCA-06 | Resend delivery email, re-queue `needs_review`, release stuck hold — each recorded on timeline | Pitfall 3 (`deliveryMessage`/`emailEnvironmentFrom` privacy) and Pattern 4 (exact delivery-CHECK column set) for resend/requeue; `releaseReservation` (already exists, Code Examples) for hold release |
| GCA-07 | Admin can create a card (amount, recipient, reason), issued/delivered like a purchase, marked admin-created | `issueAccount` full read (Pattern/Pitfall 2); `data/d1/seed.sql` grep confirming no `STORE_GIFT_CARD_MAX_MINOR` constant exists and the product's real denomination ceiling ($200 / 20000 minor units) |
| GCA-08 | Codes never shown by default; reveal (if enabled) needs confirm + audit event | `isSuperAdminActor` read in full (Security Domain); Pitfall 1 (settings-route category block) is the blocking dependency for shipping this requirement as CONTEXT.md describes it |
| GCA-09 | `gift_card_events` migration is expand-only; all admin gift-card APIs require admin auth; never return hash/ciphertext/nonce | 0022 full read confirms no prior UPDATE trigger conflicts with an additive `gift_card_events` table; `admin-gift-card-gating.test.ts`/`admin-settings-writer-source.test.ts` read as the source-contract template; Security Domain's Information-Disclosure row |
</phase_requirements>

## Summary

Phase 14 is additive admin tooling over a backend that Phase 13 already gates and that was built (migration `0022`) with the audit trail in mind — the canonical-refs comment inside `sumOutstandingGiftCardBalances` literally says "Phase 14 needs to read this before it ships gift-card management." Most of the money-moving primitives this phase needs already exist in `lib/gift-cards/repository.ts` (`issueAccount`, `releaseReservation`, `restoreRedemption`, `readBalance`) and can be called as-is or with a thin new wrapper. Three new repository capabilities are required and do not exist yet: `disableAccount`, `writeAdjustment` (the reissue drain-out entry), and a search/list query beyond the Phase-13 pagination-only `listAdminGiftCardPresentations`.

Two verified findings materially change how the plan must read CONTEXT.md's decisions:

1. **`issueAccount` cannot take a custom `issuance_business_key`.** [VERIFIED: lib/gift-cards/repository.ts:381,401-424] It always derives the key internally as `gift-card/issuance/{newCardId}/v1` via `giftCardIssuanceBusinessKey()` [VERIFIED: lib/gift-cards/domain.ts:171-174]. `IssueGiftCardInput` has no `issuanceBusinessKey` field [VERIFIED: lib/gift-cards/domain.ts:85-96]. D-06/D-07's business-key strings (`gift-card-reissue/{oldId}`, `gift-card-admin/{eventId}`) cannot be written through this function as stated. Idempotency for reissue/admin-create must instead come from a **deterministic new-card `id`** (so the `ON CONFLICT DO NOTHING` on the account INSERT converges on retry) — the business key becomes a byproduct of that id, not an independent input.
2. **The generic settings route currently refuses the *entire* `gift_cards` category, not just the honor-guard key.** [VERIFIED: app/api/admin/settings/route.ts:36-41,140-149] `writesTheHonorGuard()` returns true when `candidate.category === HONOR_GUARD_SETTING_CATEGORY` (`'gift_cards'`), with no key-level exception. Adding `gift_cards.code_reveal_enabled` under `category: 'gift_cards'` per D-12 and then trying to flip it through `POST /api/admin/settings` (D-16's stated plan) will be rejected with `400 honor_guard_read_only` by this existing guard. This function must be narrowed as part of this phase (see Pitfall 1).

Everything else — the trigger set, the delivery CHECKs, encryption/config, the order-events route/schema pattern to mirror, and the admin auth helpers — matches CONTEXT.md's canonical refs closely. The one UI-pattern correction: `app/admin/orders/[id]/page.tsx` (named in D-17 as "the pattern to copy") uses `window.confirm`, not a `Dialog`/`AlertDialog` + sonner toast combo — those live in `components/admin/reviews/ReviewModerationDashboard.tsx` and `app/admin/orders/ShipmentModal.tsx` instead, and are the better reference for D-17's confirm-dialog requirement.

**Primary recommendation:** Add `disableAccount`, `writeAdjustment`, and a search-capable `listAccounts` to `lib/gift-cards/repository.ts` following the exact idempotency patterns already used by `restoreRedemption` (single INSERT + `ON CONFLICT DO NOTHING` + reread-and-validate) and `releaseReservation` (conditional UPDATE + fallback reread); build reissue as one repository method that runs the adjustment INSERT and the `issueAccount` batch as two sequential, individually-idempotent operations (not one D1 `.batch()`) so a mid-flight retry converges safely; export a new `resendGiftCardDelivery()` from `lib/services/gift-card-fulfillment.ts` (its `deliveryMessage`/`emailEnvironmentFrom` internals are private and must stay colocated with the AAD-bound decrypt); and fix `writesTheHonorGuard()` before wiring `POST /api/admin/settings` to the reveal toggle.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gift-card search/list/detail read | API / Backend (`app/api/admin/gift-cards/**`) | Database (D1 triggers/CHECKs enforce invariants) | Admin projections are server-only; no client-side D1 access exists in this codebase |
| Disable / reissue / resend / requeue / release-hold / note / create / reveal actions | API / Backend | Database | Every mutation must pass through `lib/gift-cards/repository.ts` so the 0022 triggers stay the single source of truth for validity — never a raw client write |
| Timeline assembly (ledger + reservations + deliveries + events, merged and sorted) | API / Backend (`GET .../[id]/events`) | — | Read-time merge, no new stored view; matches `app/api/admin/orders/[id]/events/route.ts`'s pattern exactly |
| Confirm dialogs, toasts, list/detail rendering | Browser / Client (`'use client'` components) | — | `GiftCardQueue.tsx` and the new detail page are client components fetching the above API routes, same as the existing orders admin surfaces |
| Delivery-code encryption/decryption, AES-GCM key ring | API / Backend (`lib/gift-cards/encryption.ts`, `config.ts`) | — | Server-only; secrets never reach `NEXT_PUBLIC_*` or the client bundle |
| Admin-settings toggle for code-reveal | API / Backend (`app/api/admin/settings/route.ts`) | Database (`admin_settings`) | Generic settings route already exists; needs the fix in Pitfall 1 to accept this one new key |
| Server-side admin session gate | Frontend Server (SSR) (`app/admin/layout.tsx` via `checkAdminSession`) | API / Backend (`checkAdminPermissions` per-route) | Phase 13 already added the server-rendered gate; this phase's new page and routes must call the same functions, not re-implement gating |

## Standard Stack

No new external packages are required for this phase. Every capability (D1, Drizzle, Web Crypto AES-GCM/HMAC, Clerk, sonner, Radix-based Dialog/AlertDialog) is already a project dependency, exercised by the exact files below.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | already pinned (see `package.json`) | Schema types + simple inserts (`giftCardEvents`) | Matches `lib/db/schema/order-events.ts` exactly; no new ORM pattern introduced |
| `sonner` | `^2.0.8` [VERIFIED: package.json:81] | Action-outcome toasts | Already used admin-side in `app/admin/layout.tsx`, `components/admin/blog/BlogEditor.tsx`, `components/admin/reviews/ReviewModerationDashboard.tsx` |
| Radix `Dialog`/`AlertDialog` via `components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx` | in-repo | Confirm dialogs, create-card modal | Already used in `app/admin/orders/ShipmentModal.tsx` (Dialog) and `components/admin/reviews/ReviewModerationDashboard.tsx` (AlertDialog) |

### Package Legitimacy Audit

**Not applicable** — this phase introduces zero new npm/PyPI/crates dependencies. All functionality is built from in-repo modules (`lib/gift-cards/*`, `lib/db/schema/*`, `lib/auth/admin-middleware.ts`) plus already-installed packages listed above. The Package Legitimacy Gate protocol (registry check / postinstall-script scan) is skipped because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
Admin browser
   │
   ├─ GET /admin/gift-cards ─────────────► app/admin/gift-cards/page.tsx (SSR gate: resolveHonorEffective)
   │                                              │
   │                                              ▼
   │                                     GiftCardQueue.tsx (client: search box, status filter,
   │                                       "Create card" dialog, paginated table, row → detail link)
   │                                              │
   │                    fetch ───────────────────►│
   ▼                                               ▼
GET /api/admin/gift-cards?q=&status=&limit=&offset=
   │  checkAdminPermissions → resolveHonorEffective gate (both-flags-off case) →
   │  listAdminGiftCardPresentations (extended: id, code_suffix, recipient_email, purchaser) →
   │  { cards, meta: { total, limit, offset } }
   ▼
Admin browser: click a row
   │
   ├─ GET /admin/gift-cards/[id] ────────► detail page (client, modelled on orders/[id]/page.tsx)
   │        │
   │        ├─ GET /api/admin/gift-cards/[id]           → account + current balance
   │        ├─ GET /api/admin/gift-cards/[id]/events     → merged timeline (ledger ∪ reservations
   │        │                                              ∪ delivery status history ∪ gift_card_events,
   │        │                                              sorted oldest→newest)
   │        └─ action buttons, each POST .../[id]/<action>, each:
   │             checkAdminPermissions → actorFrom(auth) → bounded JSON parse →
   │             repository mutation (0022 trigger/CHECK enforces validity) →
   │             db.insert(giftCardEvents).values({...}) → typed JSON response
   ▼
D1 (gift_card_accounts / _reservations / _ledger_entries / _deliveries / gift_card_events)
   — every write still passes through the 0022 triggers; this phase adds no bypass path
```

### Recommended Project Structure

```
migrations/
└── 0024_add_gift_card_events.sql        # new table + code_suffix column (D-01, D-02)
lib/
├── db/schema/
│   └── gift-cards.ts                    # + giftCardEvents table, + codeSuffix column
├── gift-cards/
│   ├── repository.ts                    # + disableAccount, writeAdjustment, listAccounts/search, reissue
│   ├── domain.ts                        # + assertion helpers for new inputs (reason text, etc.) if needed
│   ├── timeline.ts                      # NEW (Claude's discretion, recommended location) — merges the 4 sources
│   └── presentations.ts                 # extend AdminGiftCardPresentation: id, codeSuffix, recipientEmail, purchaser label
├── services/
│   └── gift-card-fulfillment.ts         # + export resendGiftCardDelivery() reusing private deliveryMessage/emailEnvironmentFrom
app/
├── admin/gift-cards/
│   ├── page.tsx                         # existing, list only — unchanged gating
│   └── [id]/page.tsx                    # NEW detail page
├── api/admin/gift-cards/
│   ├── route.ts                         # existing GET, extend with q= search; + POST admin-create
│   └── [id]/
│       ├── route.ts                     # NEW GET detail
│       ├── events/route.ts              # NEW GET timeline
│       ├── disable/route.ts             # NEW POST
│       ├── reissue/route.ts             # NEW POST
│       ├── resend/route.ts              # NEW POST
│       ├── requeue/route.ts             # NEW POST
│       ├── release-hold/route.ts        # NEW POST
│       ├── notes/route.ts               # NEW POST
│       └── reveal/route.ts              # NEW POST
components/admin/
├── GiftCardQueue.tsx                    # rewrite: search, filter, pagination, create dialog, row links
└── GiftCardDetail/ (or similar)         # NEW: action bar, confirm dialogs, timeline, note form
```

### Pattern 1: Idempotent single-INSERT ledger write (template for `writeAdjustment`)

**What:** `restoreRedemption` shows the exact shape a new adjustment-writer should copy: compute a deterministic business key, attempt one `INSERT ... ON CONFLICT DO NOTHING RETURNING id`, and on both the "already existed" and "race lost" paths, reread and structurally validate against the caller's intended values before returning.
**When to use:** Any new ledger entry writer (the reissue drain-out `adjustment` entry).
**Example:**
```typescript
// Source: lib/gift-cards/repository.ts:685-737 (restoreRedemption), adapted shape
async writeAdjustment(args: {
  giftCardId: string;
  amount: Money;              // negative for a drain-out; balance guard trigger still applies
  businessKey: string;
  entryId?: string;
  createdAt: number;
}): Promise<{ created: boolean; entry: GiftCardLedgerEntry }> {
  const entryId = args.entryId ?? `gift_ledger_${crypto.randomUUID()}`;
  const existing = async () => { /* SELECT ... WHERE business_key = ? */ };
  const prior = await existing();
  if (prior) return { created: false, entry: prior };
  try {
    await database.prepare(`INSERT INTO gift_card_ledger_entries (
      id, gift_card_id, currency_code, entry_type, amount_delta_minor,
      business_key, order_id, reservation_id, related_entry_id, created_at
    ) VALUES (?, ?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, ?)
    ON CONFLICT DO NOTHING`).bind(/* ... */).run();
  } catch {
    // gift_card_ledger_balance_guard trigger (0022:255-267) aborts here if the
    // drain would go negative — this IS the safety net, not app-level math.
  }
  const entry = await existing();
  if (!entry) throw new GiftCardConflictError('Gift-card adjustment could not be written');
  return { created: true, entry };
}
```
Note: `entry_type = 'adjustment'` is exempt from the sign CHECK (negative deltas allowed) [VERIFIED: migrations/0022_add_gift_cards.sql:229-233, quoting: `(entry_type IN ('issuance', 'restoration') AND amount_delta_minor > 0) OR (entry_type = 'redemption' AND amount_delta_minor < 0) OR entry_type = 'adjustment'`] but **must** have `reservation_id IS NULL` [VERIFIED: migrations/0022_add_gift_cards.sql:234-237, quoting: `(entry_type = 'redemption' AND reservation_id IS NOT NULL AND order_id IS NOT NULL) OR (entry_type <> 'redemption' AND reservation_id IS NULL)`]; `order_id` is unconstrained for adjustment (may be NULL), matching D-06.

### Pattern 2: Admin mutation route skeleton

**What:** Every existing admin mutation route (`ship`, and by extension every new gift-card action route) follows one shape.
**Example:**
```typescript
// Source: app/api/admin/orders/[id]/ship/route.ts:38-42,45-56 (verified verbatim)
function actorFrom(auth: Awaited<ReturnType<typeof checkAdminPermissions>>): Actor {
  return auth.isServiceToken
    ? { type: "service", id: "api-token" }
    : { type: "admin", id: auth.userId ?? null };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json({ code: "unauthorized", error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  // readBoundedJsonBody (MAX_JSON_BODY_BYTES = 4 * 1024) — copy verbatim, ship/route.ts:12-36
  // ... typed 400/404/409/503 responses per action, matching D-13
}
```
`Actor`/`ActorType` (`"admin" | "service" | "system"`) is already defined and exported at `lib/fulfillment/types.ts:68-74` — import it directly rather than redefining; it is byte-identical to the `actor_type` CHECK vocabulary D-01 specifies for `gift_card_events`.

### Pattern 3: Simple event-append (template for `gift_card_events` writes)

**What:** `order_events` has two insert idioms in the codebase: a plain `db.insert(orderEvents).values({...})` for a straightforward append (`recordEmailEvent`), and a conditional `INSERT ... SELECT ... WHERE NOT EXISTS` for DB-level idempotency (`shipOrder`'s `shipment_created`). Since D-01 gives `gift_card_events` no CHECK-level idempotency requirement beyond the one partial-unique index on `reissued`, the simple form is the right template for every other event type.
**Example:**
```typescript
// Source: lib/fulfillment/service.ts:353-370 (recordEmailEvent, verbatim shape)
export async function appendGiftCardEvent(
  giftCardId: string,
  eventType: string,
  actor: Actor,
  details: Record<string, unknown> | undefined,
): Promise<string> {
  const db = await getDbAsync();
  const id = crypto.randomUUID();
  await db.insert(giftCardEvents).values({
    id, gift_card_id: giftCardId, event_type: eventType,
    actor_type: actor.type, actor_id: actor.id,
    details: details ?? null, created_at: Math.floor(Date.now() / 1_000), // epoch seconds (D-01), NOT ISO text
  });
  return id;
}
```
Note the epoch-seconds `created_at` (D-01 explicitly calls out that gift-card tables use integer epochs, unlike `order_events`' TEXT ISO timestamps [VERIFIED: migrations/0014_add_order_events.sql:16, `created_at  TEXT NOT NULL`] — do not copy that column's type).

### Pattern 4: Delivery re-queue — the exact column set the CHECKs require together

**What:** There is **no UPDATE trigger** on `gift_card_deliveries` [VERIFIED: migrations/0022_add_gift_cards.sql, full 440-line file read, no `BEFORE UPDATE ON gift_card_deliveries` trigger present anywhere in the file] — only the two CHECK constraints govern a re-queue UPDATE.
**Example:**
```sql
-- Source: migrations/0022_add_gift_cards.sql:429-436 (the two governing CHECKs, quoted verbatim)
-- CHECK ((status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
--        OR (status <> 'processing' AND claim_token IS NULL AND lease_expires_at IS NULL))
-- CHECK ((status IN ('sent', 'needs_review') AND completed_at IS NOT NULL)
--        OR (status IN ('pending', 'processing') AND completed_at IS NULL))
UPDATE gift_card_deliveries
SET status = 'pending', completed_at = NULL, claim_token = NULL, lease_expires_at = NULL,
    attempt_count = 0, deliver_after = ?, updated_at = ?
WHERE gift_card_id = ? AND status = 'needs_review';
```
`status`, `completed_at`, `claim_token`, `lease_expires_at` are the four columns the CHECKs jointly require to move together (matches D-09 exactly); `attempt_count = 0` and `deliver_after = now` are business logic, not DB-enforced, but D-09 already specifies both.

### Anti-Patterns to Avoid
- **Reimplementing AES-GCM decrypt or the HMAC digest in a route handler:** always call `decryptGiftCardDeliveryCode` (encryption.ts) / `parseGiftCardDeliveryKeyRing` (config.ts) — both zeroize key material in `finally` blocks; a hand-rolled call site would not.
- **Writing `gift_card_ledger_entries` or `gift_card_accounts` via Drizzle `.update()`/`.insert()` directly from a new admin route:** every existing writer goes through `lib/gift-cards/repository.ts`'s raw-`D1Database.prepare()` methods so the 0022 triggers are the enforcement point, not app code. A new admin path should follow the same discipline.
- **Reusing the original delivery's `email_idempotency_key` for a resend:** `sendEmail`'s idempotency is D1-row-backed [VERIFIED: lib/email/sender.ts:206-215] — a `"succeeded"` claim for that key short-circuits to `{ success: true }` without contacting the provider again. D-08's `gift-card-resend/{deliveryId}/{eventId}` key is required, not optional.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delivery-code encrypt/decrypt | New AES-GCM call site | `lib/gift-cards/encryption.ts` `decryptGiftCardDeliveryCode` | AAD-binds ciphertext to `(giftCardId, deliveryId)`; hand-rolling drops that binding or the key-zeroization discipline |
| Bearer-code masking | New masking logic for `code_suffix` display | `lib/gift-cards/code.ts` `maskGiftCardCode` | Already produces the exact `GC-****-...-{last4}` shape GCA-01 wants |
| Email send-once semantics | A new dedupe table or in-memory cache | `lib/email/sender.ts`'s `idempotencyKey` mechanism | Already D1-row-backed, provider-neutral, and exercised by every existing gift-card send |
| Ledger balance arithmetic | A second "available balance" SQL expression | `availableBalanceExpression` (used by `readBalance`, `presentations.ts`, `sumOutstandingGiftCardBalances`) | CONTEXT.md and the repository's own comments call out that there must be exactly one definition of "available" |
| Admin auth / super-admin check | New Clerk role logic in a route | `checkAdminPermissions`, `checkAdminSession`, `isSuperAdminActor` (`lib/auth/admin-middleware.ts`) | `isSuperAdminActor` already refuses service tokens and dev-bypass — exactly D-12's requirement |

**Key insight:** Every money-adjacent primitive this phase needs (encrypt/decrypt, balance math, idempotent send, ledger writes) already has exactly one implementation in the codebase, each with a comment explaining why a second one would be dangerous. The task in this phase is almost entirely *composition* of existing primitives behind new HTTP routes, not new domain logic.

## Common Pitfalls

### Pitfall 1: The generic settings route blocks the *entire* `gift_cards` category, not just the honor-guard key
**What goes wrong:** D-12/D-16 plan to add `gift_cards.code_reveal_enabled` (category `gift_cards`) to `defaultSettings` and flip it through the existing `POST /api/admin/settings`. That route currently rejects **any** update whose `category === 'gift_cards'` [VERIFIED: app/api/admin/settings/route.ts:36-41, quoting: `return candidate.key === HONOR_GUARD_SETTING_KEY || candidate.category === HONOR_GUARD_SETTING_CATEGORY;`], not just updates keyed on the honor-guard's specific key. A save attempt on the new setting will 400 with `honor_guard_read_only`.
**Why it happens:** The Phase-13 guard was written when the `gift_cards` category had exactly one key; its comment even says "nothing else legitimately writes under it" [VERIFIED: app/api/admin/settings/route.ts:26-34] — an assumption this phase invalidates.
**How to avoid:** Narrow `writesTheHonorGuard()` to key off `candidate.key === HONOR_GUARD_SETTING_KEY` only, and add a second, separate rejection only for that literal key if a category-wide check is still wanted for defense in depth (e.g., `candidate.category === HONOR_GUARD_SETTING_CATEGORY && candidate.key !== 'gift_cards.code_reveal_enabled'`). The existing source-contract test only requires the file to still reference `HONOR_GUARD_SETTING_KEY` [VERIFIED: tests/unit/lib/gift-cards/admin-settings-writer-source.test.ts:242-252, the `refusesGuardKey` check does `source.includes("HONOR_GUARD_SETTING_KEY") || source.includes(HONOR_GUARD_SETTING_KEY)`] — narrowing the conditional keeps that test green.
**Warning signs:** A 400 `honor_guard_read_only` response when saving the reveal toggle from the admin settings UI or from a plan-time integration test.

### Pitfall 2: `issueAccount` does not accept a custom business key
**What goes wrong:** Passing `issuanceBusinessKey` (or any similarly named field) on the `IssueGiftCardInput` object silently does nothing — `IssueGiftCardInput` has no such field [VERIFIED: lib/gift-cards/domain.ts:85-96] and `issueAccount` derives the key itself from `input.id` [VERIFIED: lib/gift-cards/repository.ts:381]. Following D-06/D-07's literal business-key strings will produce a TypeScript error (excess property) or, if loosely typed, a silently ignored field.
**Why it happens:** CONTEXT.md's canonical-refs list this function alongside a stated custom-key requirement that predates a full read of its current signature.
**How to avoid:** Make the new card's `id` itself deterministic (e.g. `stableId('gift_card_reissue', oldCardId)` in the same style as `gift-card-fulfillment.ts`'s `stableId` helper) so the naturally-derived business key (`gift-card/issuance/{newId}/v1`) is unique per reissue/admin-create attempt, and idempotency comes from the account row's own `ON CONFLICT DO NOTHING` plus the D-01 partial unique index on `(gift_card_id) WHERE event_type = 'reissued'`.
**Warning signs:** A reissue integration test that expects a specific `issuance_business_key` string to appear in the ledger fails, or a TypeScript build error on an unrecognized `IssueGiftCardInput` property.

### Pitfall 3: `deliveryMessage`, `deliverOne`, and `emailEnvironmentFrom` are module-private
**What goes wrong:** Nothing in `lib/services/gift-card-fulfillment.ts` is exported except `fulfillPaidGiftCards` and `drainGiftCardDeliveries` [VERIFIED: `grep -n "^export" lib/services/gift-card-fulfillment.ts` → only those two match]. A resend route cannot `import { deliveryMessage } from '@/lib/services/gift-card-fulfillment'`.
**Why it happens:** The file was written for exactly two call sites (the checkout order-effect and the cron drain); resend is a third, not yet anticipated.
**How to avoid:** Add a new exported function to the same file (e.g. `resendGiftCardDelivery(giftCardId, options)`) that reuses the existing private `deliveryMessage`/`emailEnvironmentFrom`/`giftMessageFor` helpers in place, rather than re-implementing AAD-bound decryption or the env-forwarding logic in a route file. This keeps the "don't hand-roll" guarantee intact and matches the file's existing privacy boundary.
**Warning signs:** A TypeScript import error on `deliveryMessage`, or (if a route reimplements the message body) a resend email whose copy silently drifts from the original delivery template.

### Pitfall 4: `gift_card_accounts_identity_immutable` looks stricter than it is for `code_suffix`
**What goes wrong:** A planner might assume the identity-immutable trigger blocks all UPDATEs to `gift_card_accounts`, including a later backfill of `code_suffix`.
**Why it happens:** The trigger's name ("identity is immutable") suggests a blanket lock.
**How to avoid:** The trigger only compares eleven **named** columns (`id`, `code_hash`, `code_hash_version`, `currency_code`, `issuance_entry_id`, `issuance_business_key`, `issued_amount_minor`, `issued_order_id`, `issued_line_id`, `purchaser_customer_id`, `created_at`) [VERIFIED: migrations/0022_add_gift_cards.sql:63-81, full `WHEN NOT (...)` clause quoted]. A column added later by `ALTER TABLE` (like `code_suffix`) is not in that list at all — the trigger cannot reference a column that didn't exist when it was compiled, so any UPDATE that changes only `code_suffix` (and leaves the eleven named columns untouched) passes trivially. In practice D-02 sets `code_suffix` at INSERT time (issuance), so this only matters if a plan considers a later backfill (which D-02 explicitly rules out — no backfill).
**Warning signs:** None expected if D-02 is followed as written (set at issuance, no backfill); flagging this only because the trigger's scope is easy to over-assume.

### Pitfall 5: `resolveHonorEffective` and `giftCardSurfacesHidden` are the *only* correct gates — don't re-derive
**What goes wrong:** A new detail page or route re-implements the both-flags-off-with-money-outstanding logic inline instead of calling the existing functions, producing a page that 404s when the list doesn't (or vice versa).
**Why it happens:** The logic (four states, guard record staleness, mixed-currency handling) is genuinely intricate — see the docstring at `lib/gift-cards/honor-guard.ts:293-323` explaining that this function replaced four independently-wrong reimplementations.
**How to avoid:** Every new page/route calls `resolveHonorEffective(database, flags, nowSeconds)` for the existence decision and `giftCardSurfacesHidden(flags)` for the presentation decision, exactly as `app/admin/gift-cards/page.tsx:61-64` and `app/api/admin/gift-cards/route.ts:52-58` already do.
**Warning signs:** The list page 404s but a bookmarked detail URL doesn't, or vice versa.

### Pitfall 6: Presentation projections currently carry no account `id`
**What goes wrong:** A detail-page link (`/admin/gift-cards/[id]`) can't be built from the current list response — `AdminGiftCardPresentation` has no `id` field [VERIFIED: lib/gift-cards/presentations.ts:11-14,16-26, full interface and row-mapper read, no `id` present anywhere].
**Why it happens:** Phase 13 built the presentation as an operational, deliberately anonymized queue view (its own doc comment says "no customer-facing listing" and lists what's excluded [VERIFIED: lib/gift-cards/presentations.ts:62-68]) — ids were not yet a requirement.
**How to avoid:** Add `account.id AS id` to `PRESENTATION_SELECT` and thread it through `mapRow`/`AdminGiftCardPresentation`, exactly as D-14 requires. This is a safe addition — account ids are internal identifiers, not bearer material, and D-14 explicitly calls this out as the one field that needs to start flowing through.
**Warning signs:** A source-contract test (D-14's forbidden-column grep) should assert the *opposite* direction too: that `id` is present, not just that code material is absent — otherwise a regression that silently drops `id` again would pass every existing test.

## Code Examples

### Full delivery-CHECK-satisfying re-queue (verified column set)
```typescript
// Columns verified against migrations/0022_add_gift_cards.sql:429-436
await database.prepare(`UPDATE gift_card_deliveries
  SET status = 'pending', completed_at = NULL, claim_token = NULL, lease_expires_at = NULL,
      attempt_count = 0, deliver_after = ?, updated_at = ?
  WHERE gift_card_id = ? AND status = 'needs_review'
  RETURNING id`).bind(now, now, giftCardId).first();
```

### Disable (already-permitted transition, no new trigger logic needed)
```typescript
// Source: migrations/0022_add_gift_cards.sql:83-107 (status_transition_guard, quoted)
// WHEN NOT (
//   (OLD.status='active' AND OLD.disabled_at IS NULL AND (
//      (NEW.status='active' AND NEW.disabled_at IS NULL)
//      OR (NEW.status='disabled' AND NEW.disabled_at IS NOT NULL AND NEW.disabled_at >= OLD.created_at)
//   ))
//   OR (OLD.status='disabled' AND NEW.status='disabled' AND NEW.disabled_at IS OLD.disabled_at)
// )
await database.prepare(`UPDATE gift_card_accounts
  SET status = 'disabled', disabled_at = ?
  WHERE id = ? AND status = 'active'
  RETURNING id`).bind(now, giftCardId).first();
// Touching only status/disabled_at also trivially satisfies gift_card_accounts_identity_immutable
// (migrations/0022_add_gift_cards.sql:63-81), which never names either column.
```

### Hold release (existing method — no new repository code needed)
```typescript
// Source: lib/gift-cards/repository.ts:744-770, verbatim signature
await repository.releaseReservation({
  reservationId,
  reason: `admin:${adminUserId}`,   // fits the 200-char CHECK (assertGiftCardReleaseReason, domain.ts:260)
  releasedAt: now,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `GiftCardQueue.tsx` as a read-only, unpaginated table | Search + status filter + pagination + action list | This phase (D-17) | Full rewrite of the component, not an incremental patch |
| `GET /api/admin/gift-cards` returns no `id`, no search | Adds `q=` search (order id / email / suffix), `id` field, `meta.total` | This phase (D-14, D-15) | Existing route extended, not replaced — existing tests (`gift-card-presentation-routes.test.ts`) must stay green while adding cases |

**Deprecated/outdated:** None — this is the first version of the admin gift-card management surface; there is no prior implementation to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Purchaser" in GCA-01's list column means either the resolved customer's display label (parsed from `customers.person` JSON [VERIFIED: lib/db/schema/customer.ts:35, `person: text("person")` — no flat email/name column]) or, more simply, the bare `purchaser_customer_id` — CONTEXT.md does not specify which, and resolving the JSON adds a join + parse the existing projection doesn't have. | GCA-01, presentations.ts extension | If the plan assumes a friendly name/email and doesn't budget the extra join+parse, the list column renders an opaque id instead of what a reviewer expects at UAT |
| A2 | D1's `.batch()` (used by `issueAccount`) executes its statements atomically as a single transaction, matching Cloudflare's documented behavior. [ASSUMED — not re-verified against Cloudflare docs this session; relied on existing code's evident design assumption] | Reissue transaction design (Pattern 1, repository.ts:382-445) | If batch is not atomic in the exact D1 runtime version this project pins, a reissue could leave the drain-out entry written without the new card issued (or vice versa) on a mid-batch failure — worth a positive check against Cloudflare's D1 docs at plan time |
| A3 | The reissue flow should NOT use a single `database.batch()` spanning both the adjustment write and `issueAccount`'s own internal batch, because `issueAccount` already owns its own `.batch()` call and nesting/combining batches across two repository methods is not a pattern seen elsewhere in this codebase. [ASSUMED] | Reissue transaction design | If two independent, sequentially-idempotent calls (adjustment then issueAccount) are not truly composable into "all or nothing," a retry after a partial failure needs both operations' idempotency keys to converge correctly — should be integration-tested explicitly (a second reissue attempt after a simulated mid-flight failure) |

## Open Questions

1. **What exactly identifies "purchaser" in the list view for a real (non-admin-created) card?**
   - What we know: `purchaser_customer_id` references `customers.id`; the customer's email/name lives in a JSON `person` column, not a flat field.
   - What's unclear: Whether GCA-01 wants the raw id, or a resolved label (requiring a join + JSON parse per row, or a batched lookup like the events route's `admin_users` join).
   - Recommendation: Follow the `admin_users` join pattern from `app/api/admin/orders/[id]/events/route.ts:49-75` — collect distinct `purchaser_customer_id`s, batch-select `customers`, parse `person` JSON for `email`/`name`, build a label map. Confirm scope with Russell at discuss-phase review if not already locked.

2. **Is D1 `.batch()` transactional enough for reissue's two-write shape?**
   - What we know: `issueAccount` already uses `.batch()` for 2-3 statements and treats the whole thing as atomic (no partial-failure handling visible in the code).
   - What's unclear: Whether the reissue flow (adjustment on old card + issueAccount batch on new card) needs its own explicit two-phase idempotency test, given it's two separate repository calls rather than one combined batch.
   - Recommendation: Write the D1 integration test CONTEXT.md's discretion section calls for — attempt reissue twice and once with an injected failure between the two writes — before trusting the "once-only" guarantee end to end.

## Environment Availability

No new external dependency, service, or CLI tool is introduced by this phase. D1, the AES-GCM/HMAC key rings, and the email provider are all already configured and verified working as of Phase 12/13 (production gift-card purchase and delivery proven live per STATE.md). Skipped per the "no external dependencies" condition.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + `@cloudflare/vitest-pool-workers` (D1 integration) [VERIFIED: vitest.workers.config.mts:1-27] |
| Config file | `vitest.workers.config.mts` (integration, real D1 via miniflare + `applyD1Migrations`); default Vitest config (unit) |
| Quick run command | `mise exec -- npx vitest run <path>` |
| Full suite command | `mise exec -- npm test` (unit) and `npm run test:workers` (D1 integration, `vitest run --config vitest.workers.config.mts`) [VERIFIED: package.json:16-17] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GCA-01 | List search (email/order id/suffix), pagination, projection fields | unit (route) | `mise exec -- npx vitest run tests/unit/app/api/gift-card-presentation-routes.test.ts` | ✅ existing, extend |
| GCA-01 | `code_suffix` column, backfill-none rule | integration (migration) | `npm run test:workers` (new `tests/integration/gift-cards-migration.test.ts` case) | ❌ Wave 0 |
| GCA-02 | Timeline merges ledger/reservations/deliveries/events, oldest-first | unit (route) + integration (real data) | new `tests/unit/app/api/gift-card-events-route.test.ts` + integration case | ❌ Wave 0 |
| GCA-03 | Note add, actor/timestamp recorded | integration | new case in `tests/integration/lib/gift-cards/repository.test.ts` or a new events-repository test | ❌ Wave 0 |
| GCA-04 | Disable with reason, ledger intact, event on timeline | integration (real triggers) | `npm run test:workers` | ❌ Wave 0 |
| GCA-05 | Reissue: adjustment + new card, once-only guard, both timelines link | integration (real triggers, proves 409 on second attempt) | `npm run test:workers` | ❌ Wave 0 |
| GCA-06 | Resend (new idempotency key), requeue (column set), release-hold | integration + unit (route mocks repository) | `npm run test:workers` + `mise exec -- npx vitest run tests/unit/app/api/admin-gift-cards-actions.test.ts` | ❌ Wave 0 |
| GCA-07 | Admin-create: issued+delivered like a purchase, "admin: name" purchaser | integration (drain reuse) | `npm run test:workers` | ❌ Wave 0 |
| GCA-08 | Reveal: setting off by default, super-admin only, confirm+event-first-then-return | unit (route, mocked super-admin check) + integration (settings write fix from Pitfall 1) | `mise exec -- npx vitest run tests/unit/app/api/admin-gift-cards-reveal.test.ts` | ❌ Wave 0 |
| GCA-09 | Migration is expand-only; no admin response carries code/hash/ciphertext/nonce; all routes require admin auth | source-contract (grep-based, like existing `admin-gift-card-gating.test.ts`) | `mise exec -- npx vitest run tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `mise exec -- npx vitest run <changed test file(s)>`
- **Per wave merge:** `mise exec -- npm test` (full unit suite) — this phase's changes touch shared files (`app/api/admin/settings/route.ts`, `lib/db/schema/settings.ts`, `lib/gift-cards/presentations.ts`) that existing tests already cover; a full run catches regressions in Phase 13's honor-guard contracts
- **Phase gate:** `mise exec -- npm test` + `npm run test:workers` both green before `/gsd-verify-work`, per CONTEXT.md D-16's explicit requirement that Phase 13's contracts stay green

### Wave 0 Gaps
- [ ] `migrations/0024_add_gift_card_events.sql` — the table + `code_suffix` column itself
- [ ] `tests/integration/gift-cards-migration.test.ts` — extend with a `0024` ordering case mirroring the existing `0022` case (apply through 0023, insert baseline rows, snapshot, apply 0024, assert baseline unchanged and new table empty) [VERIFIED: tests/integration/gift-cards-migration.test.ts:1-63, full file read as the template]
- [ ] `lib/db/schema/gift-cards.ts` — `giftCardEvents` Drizzle table, `codeSuffix` column on `giftCardAccounts`
- [ ] New repository methods: `disableAccount`, `writeAdjustment`, `listAccounts`(search), `reissue` (or equivalent composition)
- [ ] `lib/gift-cards/timeline.ts` (or inline route logic, per Claude's discretion) — the 4-source merge
- [ ] Fix to `app/api/admin/settings/route.ts`'s `writesTheHonorGuard()` (Pitfall 1) — blocking dependency for GCA-08's settings flip
- [ ] `lib/services/gift-card-fulfillment.ts` — new exported `resendGiftCardDelivery()`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes | Clerk session via `checkAdminSession`/`checkAdminPermissions`; service-token bearer via `timingSafeEqual` against `ADMIN_VECTORIZE_TOKEN` [VERIFIED: lib/auth/admin-middleware.ts:35-42] |
| V4 Access Control | yes | `isSuperAdminActor` gates reveal (service tokens and dev-bypass explicitly refused) [VERIFIED: lib/auth/admin-middleware.ts:117-122] |
| V5 Input Validation | yes | `assertGiftCardReleaseReason`/bounded-text assertions in `domain.ts`; new inputs (disable reason, note text, admin-create amount/email) need equivalent `assertBoundedText`-style guards |
| V6 Cryptography | yes — never hand-roll | AES-256-GCM via `lib/gift-cards/encryption.ts` (AAD-bound to gift-card+delivery id); HMAC-SHA-256 via `lib/gift-cards/code.ts` — both already implemented, reuse only |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Admin route returns code hash/ciphertext/nonce/claim_token/email_idempotency_key/ledger business keys in a JSON response | Information Disclosure | D-14's source-contract test (grep projection + route files for forbidden column names); every new SELECT must be hand-audited against this list before it's added to a response shape |
| Reveal endpoint abused by a compromised service token or dev-bypass session | Elevation of Privilege | `isSuperAdminActor` already refuses both [VERIFIED: lib/auth/admin-middleware.ts:118] — do not substitute `checkAdminPermissions` alone for the reveal route's authorization check |
| Forged `admin_settings` write flips `code_reveal_enabled` (or the honor guard) outside the intended writer | Tampering | Same `admin-settings-writer-source.test.ts` contract (Pitfall 1) — every new key added to the `gift_cards` category must be accounted for in `ALLOWED_WRITERS` or explicitly refused |
| Resend/requeue used to exfiltrate a code to an admin-typed address for fraud | Repudiation | D-08 requires the typed address to land on the `gift_card_events` row (not the delivery row), so the audit trail survives even though the send itself is legitimate infrastructure use |

## Sources

### Primary (HIGH confidence — read this session)
- `migrations/0022_add_gift_cards.sql` (full 440 lines) — every trigger and CHECK cited above
- `lib/gift-cards/repository.ts` (772 lines) — `issueAccount`, `readBalance`, `reserve`, `commitReservation`, `settleReservation`, `findSettledRedemption`, `restoreRedemption`, `releaseReservation`, `sumOutstandingGiftCardBalances`
- `lib/gift-cards/domain.ts`, `lib/gift-cards/encryption.ts`, `lib/gift-cards/config.ts`, `lib/gift-cards/code.ts` — full reads
- `lib/services/gift-card-fulfillment.ts` (416 lines, full read) — export surface, private helpers
- `lib/email/sender.ts` (idempotency section, lines 150-232)
- `app/api/admin/orders/[id]/ship/route.ts`, `.../events/route.ts` — full reads
- `lib/fulfillment/service.ts` (event-write patterns), `lib/fulfillment/types.ts` (`Actor`/`ActorType`)
- `lib/auth/admin-middleware.ts` (full read) — `checkAdminPermissions`, `checkAdminSession`, `isSuperAdminActor`
- `lib/db/schema/settings.ts`, `app/api/admin/settings/route.ts` — `defaultSettings`, `writesTheHonorGuard`
- `lib/gift-cards/honor-guard.ts` (full read, 376 lines)
- `lib/gift-cards/presentations.ts`, `components/admin/GiftCardQueue.tsx`, `app/admin/gift-cards/page.tsx`, `app/api/admin/gift-cards/route.ts` — full reads
- `lib/db/schema/gift-cards.ts`, `lib/db/schema/order-events.ts`, `lib/db/schema/admin_users.ts`, `lib/db/schema/customer.ts` — full reads
- `tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts`, `tests/unit/lib/gift-cards/admin-settings-writer-source.test.ts`, `tests/unit/app/api/gift-card-presentation-routes.test.ts`, `tests/unit/app/admin-gift-card-gating.test.ts`, `tests/integration/gift-cards-migration.test.ts`, `tests/integration/lib/gift-cards/repository.test.ts`, `tests/integration/helpers/d1.ts` — full or substantial reads
- `app/admin/orders/[id]/page.tsx`, `app/admin/orders/ShipmentModal.tsx`, `components/admin/reviews/ReviewModerationDashboard.tsx` — grep + targeted reads for confirm-dialog/toast pattern
- `vitest.workers.config.mts`, `package.json` (test scripts) — full reads
- `data/d1/seed.sql` (gift-card product/variant rows) — grep read, confirming denominations and absence of a `STORE_GIFT_CARD_MAX_MINOR` constant anywhere in the tree
- `.planning/phases/13-gift-card-flags/13-CONTEXT.md`, `.planning/phases/14-gift-card-admin-audit-trail/14-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — full reads

### Secondary (MEDIUM confidence)
- `docs/checkout-trust-boundary.md` "Optional capabilities" section — read but the literal string "ADR-CTB-10" does not appear as a heading in the file; the CONTEXT.md reference is informal, not a doc anchor
- `docs/customer-communications.md`, `docs/webhooks-refunds-inventory.md` — grepped for delivery-state language; the "resend disabled" paragraph found there describes order-fulfillment shipping-email resend, a different subsystem, not gift-card delivery resend

### Tertiary (LOW confidence / unverified this session)
- D1 `.batch()` atomicity guarantee (A2 in Assumptions Log) — relied on the existing `issueAccount` code's evident design assumption, not re-confirmed against current Cloudflare D1 documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, every reused module read in full
- Architecture: HIGH — every route/repository pattern cited was read verbatim with line numbers
- Pitfalls: HIGH — all six pitfalls are drawn from code actually read this session, not inferred from CONTEXT.md's descriptions alone; two (Pitfalls 1 and 2) directly contradict CONTEXT.md's stated implementation mechanism and are the most important findings for the planner

**Research date:** 2026-09-10
**Valid until:** 30 days (stable backend; the only fast-moving surface is the D1/`.batch()` atomicity assumption, worth reconfirming if the plan leans heavily on it)

## RESEARCH COMPLETE
