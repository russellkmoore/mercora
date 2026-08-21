import { Money, type MachMoney } from '@/lib/money';

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

interface PresentationRow {
  currency_code: string;
  issued_amount_minor: number;
  available_balance_minor: number;
  status: 'active' | 'disabled';
  created_at: number;
  issued_order_id: string | null;
  issued_line_id: string | null;
  delivery_status: 'pending' | 'processing' | 'sent' | 'needs_review' | null;
  delivery_attempt_count: number | null;
}

const PRESENTATION_SELECT = `SELECT account.currency_code, account.issued_amount_minor,
  (COALESCE((SELECT SUM(entry.amount_delta_minor)
    FROM gift_card_ledger_entries entry WHERE entry.gift_card_id = account.id), 0) -
    COALESCE((SELECT SUM(reservation.amount_minor) FROM gift_card_reservations reservation
      WHERE reservation.gift_card_id = account.id AND reservation.released_at IS NULL
        AND (reservation.committed_at IS NOT NULL OR reservation.expires_at > ?)
        AND NOT EXISTS (SELECT 1 FROM gift_card_ledger_entries settlement
          WHERE settlement.reservation_id = reservation.id AND settlement.entry_type = 'redemption')), 0)
  ) AS available_balance_minor,
  account.status, account.created_at, account.issued_order_id, account.issued_line_id,
  delivery.status AS delivery_status, delivery.attempt_count AS delivery_attempt_count
  FROM gift_card_accounts account
  LEFT JOIN gift_card_deliveries delivery ON delivery.gift_card_id = account.id`;

function mapRow(row: PresentationRow, admin: boolean): GiftCardPresentation | AdminGiftCardPresentation {
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
    issuedOrderId: row.issued_order_id ?? undefined,
    issuedLineId: row.issued_line_id ?? undefined,
  } : base;
}

/**
 * Both customer and operational projections deliberately omit bearer-code
 * hashes, encrypted delivery material, account ids, recipient details, and
 * ledger business keys. The database remains the source of the balance.
 */
export async function listCustomerGiftCardPresentations(args: {
  database: D1Database;
  customerId: string;
  now: number;
  limit: number;
}): Promise<GiftCardPresentation[]> {
  const result = await args.database.prepare(`${PRESENTATION_SELECT}
    WHERE account.purchaser_customer_id = ? ORDER BY account.created_at DESC LIMIT ?`)
    .bind(args.now, args.customerId, args.limit).all<PresentationRow>();
  return (result.results ?? []).map((row) => mapRow(row, false) as GiftCardPresentation);
}

export async function listAdminGiftCardPresentations(args: {
  database: D1Database;
  now: number;
  limit: number;
  offset: number;
  status?: 'active' | 'disabled';
}): Promise<{ cards: AdminGiftCardPresentation[]; total: number }> {
  const where = args.status ? 'WHERE account.status = ?' : '';
  const bindings = args.status
    ? [args.now, args.status, args.limit, args.offset]
    : [args.now, args.limit, args.offset];
  const [cards, count] = await args.database.batch([
    args.database.prepare(`${PRESENTATION_SELECT} ${where}
      ORDER BY account.created_at DESC LIMIT ? OFFSET ?`).bind(...bindings),
    args.database.prepare(`SELECT COUNT(*) AS total FROM gift_card_accounts account ${where}`)
      .bind(...(args.status ? [args.status] : [])),
  ]);
  const total = (count.results?.[0] as { total?: number } | undefined)?.total ?? 0;
  return {
    cards: (cards.results as PresentationRow[] | undefined ?? [])
      .map((row) => mapRow(row, true) as AdminGiftCardPresentation),
    total,
  };
}
