import { Money, type MachMoney } from '@/lib/money';
import { maskGiftCardCodeSuffix } from './code';

export interface GiftCardPresentation {
  issuedAmount: MachMoney;
  availableBalance: MachMoney;
  status: 'active' | 'disabled';
  createdAt: number;
  delivery: { status: 'pending' | 'processing' | 'sent' | 'needs_review'; attempts: number } | undefined;
}

export interface AdminGiftCardPresentation extends GiftCardPresentation {
  id: string;
  issuedOrderId: string | undefined;
  issuedLineId: string | undefined;
  /** D-02: the stored last-four-character group, or `undefined` for a pre-0024 card. */
  codeSuffix: string | undefined;
  /** D-02: `GC-****-...-{suffix}`, or `null` for a pre-0024 card (renders as "—"). */
  maskedCode: string | null;
  recipientEmail: string | undefined;
  /**
   * A resolved display label — the customer's name, else their email, for an
   * order-issued card; `undefined` for a card with no purchaser (admin-created
   * cards render "admin: {display name}" from the `admin_created` event
   * instead). Never the raw customer id (D-22).
   */
  purchaser: string | undefined;
}

interface PresentationRow {
  id: string;
  currency_code: string;
  issued_amount_minor: number;
  available_balance_minor: number;
  status: 'active' | 'disabled';
  created_at: number;
  issued_order_id: string | null;
  issued_line_id: string | null;
  code_suffix: string | null;
  recipient_email: string | null;
  purchaser_customer_id: string | null;
  delivery_status: 'pending' | 'processing' | 'sent' | 'needs_review' | null;
  delivery_attempt_count: number | null;
}

interface CustomerPersonRow {
  id: string;
  person: string | null;
}

const PRESENTATION_SELECT = `SELECT account.id, account.currency_code, account.issued_amount_minor,
  (COALESCE((SELECT SUM(entry.amount_delta_minor)
    FROM gift_card_ledger_entries entry WHERE entry.gift_card_id = account.id), 0) -
    COALESCE((SELECT SUM(reservation.amount_minor) FROM gift_card_reservations reservation
      WHERE reservation.gift_card_id = account.id AND reservation.released_at IS NULL
        AND (reservation.committed_at IS NOT NULL OR reservation.expires_at > ?)
        AND NOT EXISTS (SELECT 1 FROM gift_card_ledger_entries settlement
          WHERE settlement.reservation_id = reservation.id AND settlement.entry_type = 'redemption')), 0)
  ) AS available_balance_minor,
  account.status, account.created_at, account.issued_order_id, account.issued_line_id,
  account.code_suffix, account.purchaser_customer_id, delivery.recipient_email,
  delivery.status AS delivery_status, delivery.attempt_count AS delivery_attempt_count
  FROM gift_card_accounts account
  LEFT JOIN gift_card_deliveries delivery ON delivery.gift_card_id = account.id`;

function mapRow(
  row: PresentationRow,
  admin: boolean,
  purchaser: string | undefined,
): GiftCardPresentation | AdminGiftCardPresentation {
  const issuedAmount = Money.fromMinor(row.issued_amount_minor, row.currency_code).toMach();
  const availableBalance = Money.fromMinor(row.available_balance_minor, row.currency_code).toMach();
  const base: GiftCardPresentation = {
    issuedAmount,
    availableBalance,
    status: row.status,
    createdAt: row.created_at,
    delivery: row.delivery_status === null || row.delivery_attempt_count === null ? undefined : {
      status: row.delivery_status,
      attempts: row.delivery_attempt_count,
    },
  };
  return admin ? {
    ...base,
    id: row.id,
    issuedOrderId: row.issued_order_id ?? undefined,
    issuedLineId: row.issued_line_id ?? undefined,
    codeSuffix: row.code_suffix ?? undefined,
    maskedCode: maskGiftCardCodeSuffix(row.code_suffix),
    recipientEmail: row.recipient_email ?? undefined,
    purchaser,
  } : base;
}

/**
 * Resolves a display label from a MACH `person` JSON blob: the full name,
 * else first + last name, else the email. `undefined` on missing/malformed
 * JSON — never throws, since this runs over stored data outside this module's
 * control.
 */
function purchaserLabelFromPerson(personJson: string | null): string | undefined {
  if (!personJson) return undefined;
  try {
    const person = JSON.parse(personJson) as {
      full_name?: unknown; first_name?: unknown; last_name?: unknown; email?: unknown;
    };
    const fullName = typeof person.full_name === 'string' ? person.full_name.trim() : '';
    if (fullName) return fullName;
    const combined = [person.first_name, person.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim())
      .join(' ');
    if (combined) return combined;
    return typeof person.email === 'string' && person.email.trim() ? person.email.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Batched purchaser-label lookup over `customers`, in the same "one query for
 * the whole page" style as the `admin_users` label join in the orders events
 * route — never a per-row correlated subquery. The raw customer id is never
 * returned (D-22).
 */
async function resolvePurchaserLabels(
  database: D1Database,
  customerIds: readonly string[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (customerIds.length === 0) return labels;
  const placeholders = customerIds.map(() => '?').join(', ');
  const { results } = await database.prepare(
    `SELECT id, person FROM customers WHERE id IN (${placeholders})`,
  ).bind(...customerIds).all<CustomerPersonRow>();
  for (const row of results ?? []) {
    const label = purchaserLabelFromPerson(row.person);
    if (label) labels.set(row.id, label);
  }
  return labels;
}

/** D-15: one bound-parameter WHERE fragment for the status filter and the ordered `q` match. */
function buildWhere(args: { status?: 'active' | 'disabled'; q?: string }): {
  clause: string;
  bindings: unknown[];
} {
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (args.status) {
    clauses.push('account.status = ?');
    bindings.push(args.status);
  }
  if (typeof args.q === 'string' && args.q.length > 0) {
    clauses.push(
      '(account.issued_order_id = ? OR LOWER(delivery.recipient_email) = LOWER(?)'
        + ' OR LOWER(account.code_suffix) = LOWER(?))',
    );
    bindings.push(args.q, args.q, args.q);
  }
  return { clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', bindings };
}

/**
 * D-14: the admin projection. Account ids are included — the detail link is
 * built from `id` — while code material never is: `PRESENTATION_SELECT` never
 * carries `code_hash`, `code_ciphertext`, `code_nonce`, `code_key_version`,
 * `claim_token`, `email_idempotency_key`, or any ledger business key.
 * `admin-gift-card-forbidden-columns.test.ts` pins both directions — the
 * absence of code material and the presence of `id` — as a test, not review
 * discipline. D-15 adds an optional `q`, matched in order against the issuing
 * order id, the recipient email, and the code suffix.
 */
export async function listAdminGiftCardPresentations(args: {
  database: D1Database;
  now: number;
  limit: number;
  offset: number;
  status?: 'active' | 'disabled';
  q?: string;
}): Promise<{ cards: AdminGiftCardPresentation[]; total: number }> {
  const { clause: where, bindings: whereBindings } = buildWhere(args);
  const [cardsResult, countResult] = await args.database.batch([
    args.database.prepare(`${PRESENTATION_SELECT} ${where}
      ORDER BY account.created_at DESC LIMIT ? OFFSET ?`)
      .bind(args.now, ...whereBindings, args.limit, args.offset),
    args.database.prepare(`SELECT COUNT(*) AS total FROM gift_card_accounts account
      LEFT JOIN gift_card_deliveries delivery ON delivery.gift_card_id = account.id ${where}`)
      .bind(...whereBindings),
  ]);
  const total = (countResult.results?.[0] as { total?: number } | undefined)?.total ?? 0;
  const rows = (cardsResult.results as PresentationRow[] | undefined) ?? [];

  const purchaserIds = [...new Set(
    rows.map((row) => row.purchaser_customer_id).filter((id): id is string => Boolean(id)),
  )];
  const purchaserLabels = await resolvePurchaserLabels(args.database, purchaserIds);

  return {
    cards: rows.map((row) => mapRow(
      row,
      true,
      row.purchaser_customer_id ? purchaserLabels.get(row.purchaser_customer_id) : undefined,
    ) as AdminGiftCardPresentation),
    total,
  };
}

/**
 * D-13/D-16: the single-card counterpart to `listAdminGiftCardPresentations`.
 * `GET /api/admin/gift-cards/[id]` needs this exact projection (masked code,
 * code suffix, delivery status, resolved purchaser label) and the plan's own
 * objective forbids a SQL statement inside the route — so the detail route
 * calls into this module rather than duplicating `PRESENTATION_SELECT`.
 * `undefined` for an unknown id; the caller maps that to 404.
 */
export async function getAdminGiftCardPresentation(
  database: D1Database,
  id: string,
  now: number,
): Promise<AdminGiftCardPresentation | undefined> {
  const row = await database.prepare(`${PRESENTATION_SELECT} WHERE account.id = ? LIMIT 1`)
    .bind(now, id).first<PresentationRow>();
  if (!row) return undefined;
  const purchaserLabels = row.purchaser_customer_id
    ? await resolvePurchaserLabels(database, [row.purchaser_customer_id])
    : new Map<string, string>();
  return mapRow(
    row,
    true,
    row.purchaser_customer_id ? purchaserLabels.get(row.purchaser_customer_id) : undefined,
  ) as AdminGiftCardPresentation;
}
