# Phase 14: Gift-Card Admin & Audit Trail - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 22 new/modified
**Analogs found:** 22 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `migrations/0024_add_gift_card_events.sql` | migration | batch/DDL | `migrations/0014_add_order_events.sql` | exact (mirror, epoch not text) |
| `lib/db/schema/gift-cards.ts` (+giftCardEvents, +codeSuffix) | model | CRUD | `lib/db/schema/order-events.ts` | exact |
| `lib/gift-cards/repository.ts` (+disableAccount, +writeAdjustment, +listAccounts, +reissue) | service | CRUD | `lib/gift-cards/repository.ts` `restoreRedemption`/`releaseReservation` (same file, new methods) | exact — self-analog |
| `lib/gift-cards/events.ts` / `timeline.ts` | service | event-driven / transform | `lib/fulfillment/service.ts` (`recordEmailEvent`, `listRecentOrderEvents`) | role-match |
| `lib/gift-cards/presentations.ts` (extend) | transform | transform | same file, existing `PRESENTATION_SELECT`/`mapRow` | exact — self-analog |
| `lib/services/gift-card-fulfillment.ts` (+resendGiftCardDelivery export) | service | event-driven | same file's private `deliveryMessage`/`emailEnvironmentFrom` | exact — self-analog |
| `app/api/admin/gift-cards/route.ts` (extend GET q=, +POST admin-create) | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` (POST shape) + same file's existing GET | exact |
| `app/api/admin/gift-cards/[id]/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` (GET-detail shape, adapted) | role-match |
| `app/api/admin/gift-cards/[id]/events/route.ts` | route | request-response | `app/api/admin/orders/[id]/events/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/disable/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/reissue/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/resend/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/requeue/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/release-hold/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/notes/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` | exact |
| `app/api/admin/gift-cards/[id]/reveal/route.ts` | route | request-response | `app/api/admin/orders/[id]/ship/route.ts` + `isSuperAdminActor` from `lib/auth/admin-middleware.ts` | role-match (extra auth gate) |
| `app/api/admin/settings/route.ts` (narrow `writesTheHonorGuard`) | route | request-response | same file — self-edit | exact |
| `lib/db/schema/settings.ts` (+ `gift_cards.code_reveal_enabled` default) | config | CRUD | same file's existing `defaultSettings` entries | exact — self-analog |
| `app/admin/gift-cards/page.tsx` | route (SSR) | request-response | same file — unchanged gating, list mount point | exact — self-analog |
| `app/admin/gift-cards/[id]/page.tsx` | component | request-response | `app/admin/orders/[id]/page.tsx` | role-match |
| `components/admin/GiftCardQueue.tsx` (rewrite) | component | request-response | same file (current skeleton) + `app/admin/orders/ShipmentModal.tsx` for dialog conventions | exact — self-analog + role-match |
| Detail/action components (confirm dialogs, note form, timeline) | component | request-response | `components/admin/reviews/ReviewModerationDashboard.tsx` (AlertDialog/Dialog + sonner) | exact |
| `tests/integration/gift-cards-migration.test.ts` (+0024 case) | test | batch | same file — self-analog | exact |
| `tests/integration/lib/gift-cards/repository.test.ts` (+new methods) | test | CRUD | same file — self-analog | exact |
| `tests/unit/app/api/gift-card-presentation-routes.test.ts` (+q= cases) | test | request-response | same file — self-analog | exact |

## Pattern Assignments

### `migrations/0024_add_gift_card_events.sql` (migration)

**Analog:** `migrations/0014_add_order_events.sql` (verbatim, full file)

```sql
CREATE TABLE IF NOT EXISTS order_events (
  id          TEXT PRIMARY KEY NOT NULL,
  order_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  from_status TEXT,
  to_status   TEXT,
  details     TEXT CHECK (
    details IS NULL OR (json_valid(details) AND json_type(details) = 'object')
  ),
  created_at  TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS order_events_order_id_created_at_idx
  ON order_events (order_id, created_at);

CREATE INDEX IF NOT EXISTS order_events_event_type_created_at_idx
  ON order_events (event_type, created_at);
```

**Deltas required by D-01** (do not copy these two things):
- `created_at` must be `INTEGER` epoch seconds, not `TEXT` — every other gift-card table (`gift_card_accounts`, `_ledger_entries`, `_reservations`) uses integer epochs; matching `order_events`' TEXT here would be inconsistent with the table's own FK parent.
- `gift_card_id` FK is `ON DELETE RESTRICT` (not `CASCADE` like `order_events`), per D-01 and the rest of the gift-card schema (`migrations/0022_add_gift_cards.sql` restricts throughout).
- `actor_type` gets a `CHECK IN ('admin','service','system')` — `order_events` has no such CHECK; gift-card events add it per D-01.
- Add a partial `UNIQUE` index: `CREATE UNIQUE INDEX gift_card_events_reissued_once_idx ON gift_card_events (gift_card_id) WHERE event_type = 'reissued';`
- Same `ALTER TABLE` statement block also adds `code_suffix TEXT NULL` to `gift_card_accounts` (D-02) — put this in the same migration file, after the new table.

---

### `lib/db/schema/gift-cards.ts` (+giftCardEvents Drizzle table)

**Analog:** `lib/db/schema/order-events.ts` (verbatim, full file above)

Copy the `sqliteTable` + two-index shape exactly, swapping:
- table name `gift_card_events`
- `gift_card_id` FK targets `giftCardAccounts.id` (imported from the same file) with `{ onDelete: "restrict" }`
- drop `from_status`/`to_status` columns (not part of D-01's vocabulary)
- `created_at: integer("created_at").notNull()` instead of `text(...)`
- add `codeSuffix: text("code_suffix")` to the existing `giftCardAccounts` table definition (find it in the same file; add alongside other nullable display columns)

---

### `lib/gift-cards/repository.ts` (+disableAccount, +writeAdjustment, +listAccounts, +reissue)

**Analog:** same file, `restoreRedemption` (lines 685-737) and `releaseReservation` (lines ~744+) — the file's own idempotent-write idiom.

**Idempotent single-INSERT pattern** (`restoreRedemption`, verbatim):
```typescript
async restoreRedemption(args: {
  redemptionEntryId: string;
  orderId: string;
  refundKey: string;
  amount: Money;
  restoredAt: number;
  entryId?: string;
}): Promise<{ created: boolean; entry: GiftCardLedgerEntry }> {
  assertGiftCardId(args.redemptionEntryId, 'gift-card redemption entry id');
  // ... assertion helpers from domain.ts
  const businessKey = giftCardRestorationBusinessKey(args.redemptionEntryId, args.refundKey);
  const entryId = args.entryId ?? `gift_ledger_${crypto.randomUUID()}`;
  const existing = async (): Promise<GiftCardLedgerEntry | undefined> => {
    const row = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
      .bind(businessKey).first<LedgerRow>();
    return row ? mapLedger(row) : undefined;
  };
  const validate = (entry: GiftCardLedgerEntry): GiftCardLedgerEntry => {
    if (/* structural mismatch */) throw new GiftCardConflictError('...');
    return entry;
  };
  const prior = await existing();
  if (prior) return { created: false, entry: validate(prior) };

  let inserted: { id: string } | null;
  try {
    inserted = await database.prepare(`INSERT INTO gift_card_ledger_entries (
      id, gift_card_id, currency_code, entry_type, amount_delta_minor,
      business_key, order_id, reservation_id, related_entry_id, created_at
    ) VALUES (...) ON CONFLICT DO NOTHING RETURNING id`).bind(/* ... */).first<{ id: string }>();
  } catch {
    const raced = await existing();
    if (raced) return { created: false, entry: validate(raced) };
    throw new GiftCardConflictError('Gift-card redemption cannot be restored');
  }
  const entry = await existing();
  if (!entry) throw new GiftCardConflictError('...');
  return { created: inserted?.id === entryId, entry: validate(entry) };
}
```

**`writeAdjustment`** copies this shape exactly with `entry_type = 'adjustment'`, business key `gift-card-reissue-out/{oldId}`, negative `amount_delta_minor` (the 0022 balance-guard trigger, not app code, rejects a drain past zero — let the `catch` block surface that as a conflict, do not pre-check balance in app code).

**`disableAccount`** — no idempotent-INSERT needed (single conditional UPDATE); use the CONTEXT/RESEARCH-verified shape:
```typescript
await database.prepare(`UPDATE gift_card_accounts
  SET status = 'disabled', disabled_at = ?
  WHERE id = ? AND status = 'active'
  RETURNING id`).bind(now, giftCardId).first();
```

**`reissue`** — per RESEARCH Pitfall 2, `issueAccount` (same file) takes no custom business key; it derives one from `input.id`. Make the **new card's id deterministic** (`stableId('gift-card-reissue', oldCardId)`, mirroring the `stableId` helper already used in `lib/services/gift-card-fulfillment.ts`) so `issueAccount`'s own `ON CONFLICT DO NOTHING` plus the D-01 partial unique index on `(gift_card_id) WHERE event_type='reissued'` give the once-only guarantee. Run `writeAdjustment` (old card) then `issueAccount` (new card) as two sequential idempotent calls — not one combined `.batch()` — per RESEARCH's Pattern 1 recommendation and Assumption A3.

**`listAccounts`/search** — extend `PRESENTATION_SELECT` (see presentations.ts below) with a `WHERE` built from `q` matched against `issued_order_id`, the delivery's `recipient_email` (case-insensitive), or `code_suffix` (case-insensitive) — same file's existing query-builder style, no new query-building abstraction needed.

---

### `lib/gift-cards/presentations.ts` (extend `AdminGiftCardPresentation`)

**Analog:** same file, current `PRESENTATION_SELECT`/`PresentationRow`/`mapRow` (lines 1-40 read in full).

```typescript
export interface GiftCardPresentation {
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: 'active' | 'disabled';
  createdAt: number;
  delivery: { status: 'pending' | 'processing' | 'sent' | 'needs_review'; attempts: number } | undefined;
}
export interface AdminGiftCardPresentation extends GiftCardPresentation {
  issuedOrderId: string | undefined;
  issuedLineId: string | undefined;
}
const PRESENTATION_SELECT = `SELECT account.currency_code, account.issued_amount_minor,
  (COALESCE((SELECT SUM(entry.amount_delta_minor) FROM gift_card_ledger_entries entry
    WHERE entry.gift_card_id = account.id), 0) - COALESCE((SELECT SUM(reservation.amount_minor)
    FROM gift_card_reservations reservation WHERE ...), 0)) AS available_balance_minor,
  account.status, account.created_at, account.issued_order_id, account.issued_line_id,
  delivery.status AS delivery_status, delivery.attempt_count AS delivery_attempt_count
  FROM gift_card_accounts account
  LEFT JOIN gift_card_deliveries delivery ON delivery.gift_card_id = account.id`;
```

**Additions required (D-14, RESEARCH Pitfall 6):** add `account.id AS id`, `account.code_suffix AS code_suffix`, `delivery.recipient_email AS recipient_email`, and a purchaser join (batched `customers` lookup, same idiom as the `admin_users` batch join in the events route below — do not add a per-row subquery). **Never add** `code_hash`, `code_ciphertext`, `code_nonce`, `code_key_version`, `claim_token`, `email_idempotency_key`, or any `business_key` column to this SELECT (D-14).

---

### `lib/gift-cards/events.ts` / `timeline.ts` (new)

**Analog A — event append:** `lib/fulfillment/service.ts` `recordEmailEvent` shape (verbatim per RESEARCH):
```typescript
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
    details: details ?? null, created_at: Math.floor(Date.now() / 1_000), // epoch seconds, not ISO text
  });
  return id;
}
```
Import `Actor`/`ActorType` from `lib/fulfillment/types.ts` — already `"admin" | "service" | "system"`, byte-identical to D-01's CHECK vocabulary; do not redefine.

**Analog B — timeline merge:** `app/api/admin/orders/[id]/events/route.ts`'s inline merge/sort/label-join (see route pattern below) is the shape to lift into `timeline.ts`: gather four sources (ledger, reservations, delivery status history, `gift_card_events`), map each to a common `{ id, type, actorType, actorId, details, createdAt }` shape, sort ascending by `createdAt`, batch-resolve `admin_users` labels for `actor_type === 'admin'` rows exactly as the orders route does.

---

### `app/api/admin/gift-cards/[id]/disable|reissue|resend|requeue|release-hold|notes|reveal/route.ts` (all mutation routes)

**Analog:** `app/api/admin/orders/[id]/ship/route.ts` (verbatim, full pattern below) — this is the one skeleton for every mutation route in this phase (D-13).

**Imports pattern:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import type { Actor } from "@/lib/fulfillment/types";
```

**Bounded JSON body helper** (copy verbatim, adjust name if colocated per-route or lifted to a shared `lib/gift-cards/http.ts`):
```typescript
const MAX_JSON_BODY_BYTES = 4 * 1_024;

async function readBoundedJsonBody(
  request: Request,
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; code: "invalid_json" | "request_too_large"; error: string; status: 400 | 413 }
> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    return { ok: false, code: "request_too_large", error: "Request body is too large", status: 413 };
  }
  if (!raw) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, code: "invalid_json", error: "Invalid request body", status: 400 };
  }
}
```

**Actor helper** (copy verbatim — this IS the D-01 actor vocabulary):
```typescript
function actorFrom(auth: Awaited<ReturnType<typeof checkAdminPermissions>>): Actor {
  return auth.isServiceToken
    ? { type: "service", id: "api-token" }
    : { type: "admin", id: auth.userId ?? null };
}
```

**Route signature (Next.js 16 async params) + auth gate:**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json(
      { code: "unauthorized", error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) {
    return NextResponse.json({ code: bodyResult.code, error: bodyResult.error }, { status: bodyResult.status });
  }
  const { id } = await params;
  const actor = actorFrom(auth);
  // repository call, typed 400/404/409/503 responses per D-13
}
```

**Reveal route only** — add the extra super-admin gate on top of the pattern above (D-12), from `lib/auth/admin-middleware.ts`:
```typescript
export async function isSuperAdminActor(result: AdminAuthResult): Promise<boolean> {
  if (!result.success || !result.userId || result.isServiceToken || result.isDevMode) {
    return false;
  }
  return isUserSuperAdmin(result.userId);
}
```
Call `isSuperAdminActor(auth)` after the `checkAdminPermissions` gate and 403 if false, before touching ciphertext. Write the `code_revealed` event **before** returning the code (D-12) — if the event write throws, return an error, not the code.

---

### `app/api/admin/gift-cards/[id]/events/route.ts` (timeline read)

**Analog:** `app/api/admin/orders/[id]/events/route.ts` (verbatim, full file read above).

Reuse directly: bounded `limit` query-param parsing, the `admin_users` batched label join —
```typescript
import { inArray } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema/admin_users";
// ...
const adminIds = [...new Set(rows.filter(r => r.actorType === "admin" && r.actorId).map(r => r.actorId as string))];
if (adminIds.length > 0) {
  const db = await getDbAsync();
  const admins = await db.select({ userId: adminUsers.userId, email: adminUsers.email, displayName: adminUsers.displayName })
    .from(adminUsers).where(inArray(adminUsers.userId, adminIds));
  // build actorLabels map: displayName || email
}
```
Response shape per D-04: `{ events: [{ id, type, actorType, actorId, actorLabel, details, createdAt }], meta }` — drop `fromStatus`/`toStatus` (not part of the gift-card timeline; ledger/reservation/delivery rows carry their own `type`/`details` instead).

---

### `app/api/admin/settings/route.ts` (narrow `writesTheHonorGuard`)

**Analog:** same file, current implementation (verbatim):
```typescript
function writesTheHonorGuard(update: unknown): boolean {
  if (!update || typeof update !== "object") return false;
  const candidate = update as Record<string, unknown>;
  return candidate.key === HONOR_GUARD_SETTING_KEY
    || candidate.category === HONOR_GUARD_SETTING_CATEGORY;
}
```
**Required change (D-20, RESEARCH Pitfall 1):** narrow the `category` branch so it no longer refuses the whole `gift_cards` category — only the literal honor-guard key:
```typescript
function writesTheHonorGuard(update: unknown): boolean {
  if (!update || typeof update !== "object") return false;
  const candidate = update as Record<string, unknown>;
  return candidate.key === HONOR_GUARD_SETTING_KEY;
}
```
Keep the `HONOR_GUARD_SETTING_KEY` import/reference in the file (the existing source-contract test `tests/unit/lib/gift-cards/admin-settings-writer-source.test.ts` only checks the file still references that constant, per RESEARCH). Add a test case asserting `gift_cards.code_reveal_enabled` is now accepted while the guard key is still 400.

---

### `lib/db/schema/settings.ts` (+`gift_cards.code_reveal_enabled`)

**Analog:** same file's existing `defaultSettings` entries (verbatim shape):
```typescript
{
  key: 'system.maintenance_mode',
  value: JSON.stringify(false),
  category: 'system',
  description: 'Block public access (admin still accessible)',
  data_type: 'boolean'
},
```
New entry: `key: 'gift_cards.code_reveal_enabled'`, `category: 'gift_cards'`, `data_type: 'boolean'`, `value: JSON.stringify(false)` (off by default, D-12), with a description naming the audit consequence.

---

### `app/admin/gift-cards/[id]/page.tsx` (detail page)

**Analog:** `app/admin/orders/[id]/page.tsx` — header card, action bar, loading/error state structure (per D-17). **Correction from RESEARCH:** that file uses `window.confirm`, not Dialog/AlertDialog + sonner — do NOT copy its confirm pattern.

**Confirm dialogs / toasts analog:** `components/admin/reviews/ReviewModerationDashboard.tsx` imports (verbatim):
```typescript
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
```
Use `AlertDialog` for destructive/consequential confirms (disable, reissue, release-hold, reveal) and `Dialog` for input forms (create-card, notes) — matches `app/admin/orders/ShipmentModal.tsx`'s `Dialog` usage for the ship/tracking form.

---

### `components/admin/GiftCardQueue.tsx` (rewrite: search, filter, pagination, create dialog)

**Analog:** same file's current skeleton (`'use client'`, `useCallback`/`useEffect` fetch-and-map-to-`Money` idiom) — keep the money-formatting helper:
```typescript
function money(value: MachMoney) { return Money.fromMajor(value.amount, value.currency).format(); }
```
Add: search input bound to `?q=`, status `<select>`, Prev/Next using `meta.total`/`limit`/`offset` (D-15), row `<Link href={`/admin/gift-cards/${card.id}`}>`, and a "Create card" button opening a `Dialog` per `ShipmentModal.tsx`'s structure.

---

## Shared Patterns

### Admin auth gate (all routes)
**Source:** `lib/auth/admin-middleware.ts` — `checkAdminPermissions`, `isSuperAdminActor`
**Apply to:** every new route file. Standard gate is `checkAdminPermissions`; the reveal route additionally requires `isSuperAdminActor`.

### Actor construction
**Source:** `app/api/admin/orders/[id]/ship/route.ts` lines ~38-42 (`actorFrom`)
**Apply to:** every mutation route and every `appendGiftCardEvent` call — reuse `Actor`/`ActorType` from `lib/fulfillment/types.ts`, do not redeclare.

### Bounded JSON body parsing
**Source:** `app/api/admin/orders/[id]/ship/route.ts` lines 12-36 (`readBoundedJsonBody`, `MAX_JSON_BODY_BYTES = 4 * 1024`)
**Apply to:** every POST route in this phase (D-13).

### Ledger/account writes go only through the repository
**Source:** `lib/gift-cards/repository.ts` (raw `D1Database.prepare()`, never Drizzle `.update()`/`.insert()` on money tables)
**Apply to:** `disableAccount`, `writeAdjustment`, `reissue`, requeue, release-hold — every write that touches `gift_card_accounts`, `_ledger_entries`, `_reservations`, `_deliveries` must go through this module so the 0022 triggers stay the enforcement point.

### Event append (audit trail)
**Source:** `lib/fulfillment/service.ts` `recordEmailEvent`, adapted as `appendGiftCardEvent` in the new `lib/gift-cards/events.ts`
**Apply to:** every mutation route, after the repository call succeeds — disable, reissue (`reissued`/`reissued_from`), resend (`delivery_resent`), requeue (`delivery_requeued`), release-hold (`hold_released`), notes (`note`), admin-create (`admin_created`), reveal (`code_revealed`, written before the response).

### Forbidden-column discipline
**Source:** D-14, D-09 (`lib/gift-cards/presentations.ts` doc comment on what's excluded)
**Apply to:** every SELECT/response shape in this phase — never emit `code_hash`, `code_ciphertext`, `code_nonce`, `code_key_version`, `claim_token`, `email_idempotency_key`, or any `business_key` column. `account.id` is the one previously-excluded field that now must flow through (RESEARCH Pitfall 6).

### Confirm dialog + toast UX
**Source:** `components/admin/reviews/ReviewModerationDashboard.tsx` (AlertDialog/Dialog + sonner), `app/admin/orders/ShipmentModal.tsx` (Dialog form)
**Apply to:** all admin gift-card UI action buttons (D-17, D-22) — not `app/admin/orders/[id]/page.tsx`'s `window.confirm`.

## No Analog Found

None — every file in scope has a same-file or same-role tracked analog in the codebase.

## Metadata

**Analog search scope:** `migrations/`, `lib/db/schema/`, `lib/gift-cards/`, `lib/fulfillment/`, `lib/services/`, `app/api/admin/orders/`, `app/api/admin/gift-cards/`, `app/api/admin/settings/`, `app/admin/orders/`, `app/admin/gift-cards/`, `components/admin/`, `lib/auth/`, `tests/integration/`, `tests/unit/app/api/`
**Files scanned:** ~25 (all verified tracked via `git ls-files`)
**Pattern extraction date:** 2026-09-10

## PATTERN MAPPING COMPLETE
