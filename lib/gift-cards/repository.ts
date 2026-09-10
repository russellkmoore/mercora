import { Money } from "@/lib/money";
import {
  assertGiftCardBusinessKey,
  assertGiftCardCodeHash,
  assertGiftCardCodeSuffix,
  assertGiftCardCurrency,
  assertGiftCardEpoch,
  assertGiftCardId,
  assertGiftCardMoney,
  assertGiftCardReleaseReason,
  assertIssueGiftCardInput,
  assertReserveGiftCardInput,
  giftCardIssuanceBusinessKey,
  giftCardRestorationBusinessKey,
  giftCardRedemptionBusinessKey,
  giftCardReissueAdjustmentBusinessKey,
  giftCardReissueId,
  type GiftCardAccount,
  type GiftCardCodeHash,
  type GiftCardLedgerEntry,
  type GiftCardReservation,
  type IssueGiftCardInput,
  type ReserveGiftCardInput,
} from "./domain";
import { assertGiftCardEventDetails, type GiftCardEventType } from "./events";
import type { Actor } from "@/lib/fulfillment/types";

interface AccountRow {
  id: string;
  code_hash: string;
  code_hash_version: number;
  currency_code: string;
  status: "active" | "disabled";
  issuance_entry_id: string;
  issuance_business_key: string;
  issued_amount_minor: number;
  issued_order_id: string | null;
  issued_line_id: string | null;
  purchaser_customer_id: string | null;
  created_at: number;
  disabled_at: number | null;
}

interface ReservationRow {
  id: string;
  gift_card_id: string;
  currency_code: string;
  request_key: string;
  quote_fingerprint: string;
  requested_amount_minor: number;
  amount_minor: number;
  reserved_at: number;
  expires_at: number;
  committed_order_id: string | null;
  committed_at: number | null;
  released_at: number | null;
  release_reason: string | null;
}

interface LedgerRow {
  id: string;
  gift_card_id: string;
  currency_code: string;
  entry_type: "issuance" | "redemption" | "restoration" | "adjustment";
  amount_delta_minor: number;
  business_key: string;
  order_id: string | null;
  reservation_id: string | null;
  related_entry_id: string | null;
  created_at: number;
}

interface BalanceRow {
  currency_code: string;
  ledger_balance_minor: number;
  held_amount_minor: number;
}

/** An audit row written inside an issuance batch (see `issueAccountWithEvents`). */
export interface GiftCardBatchedEvent {
  eventType: GiftCardEventType;
  actor: Actor;
  details: Record<string, unknown>;
  /** Defaults to the issuance's `createdAt`. */
  createdAt?: number;
  /** Defaults to true: skip the INSERT if the card already has this event type. */
  onceOnly?: boolean;
}

export class GiftCardConflictError extends Error {}
export class GiftCardUnavailableError extends Error {}

export interface GiftCardBalance {
  ledgerBalance: Money;
  heldAmount: Money;
  availableBalance: Money;
}

export type GiftCardReservationResult =
  | { available: true; created: boolean; reservation: GiftCardReservation }
  | { available: false };

/** A reservation plus whether a `redemption` ledger entry has settled it (D-10). */
export interface GiftCardReservationWithSettlement extends GiftCardReservation {
  settled: boolean;
}

export type GiftCardReservationClass =
  | "open"
  | "committed_unsettled"
  | "released"
  | "expired"
  | "settled";

/**
 * One definition of reservation state, shared by the reissue guard, the
 * release-hold route and the timeline (D-10). Pure — takes the settlement fact
 * `findReservations` already joined in, rather than querying again.
 */
export function classifyGiftCardReservation(
  reservation: GiftCardReservationWithSettlement,
  nowSeconds: number,
): GiftCardReservationClass {
  if (reservation.releasedAt !== undefined) return "released";
  if (reservation.committedAt !== undefined) {
    return reservation.settled ? "settled" : "committed_unsettled";
  }
  return reservation.expiresAt > nowSeconds ? "open" : "expired";
}

const ACCOUNT_SELECT = `SELECT id, code_hash, code_hash_version, currency_code,
  status, issuance_entry_id, issuance_business_key, issued_amount_minor,
  issued_order_id, issued_line_id, purchaser_customer_id, created_at, disabled_at
  FROM gift_card_accounts`;

const RESERVATION_SELECT = `SELECT id, gift_card_id, currency_code, request_key,
  quote_fingerprint, requested_amount_minor, amount_minor, reserved_at, expires_at,
  committed_order_id, committed_at, released_at, release_reason
  FROM gift_card_reservations`;

const LEDGER_SELECT = `SELECT id, gift_card_id, currency_code, entry_type,
  amount_delta_minor, business_key, order_id, reservation_id, related_entry_id,
  created_at FROM gift_card_ledger_entries`;

function mapAccount(row: AccountRow): GiftCardAccount {
  const account: GiftCardAccount = {
    id: row.id,
    codeHash: { keyVersion: row.code_hash_version, digest: row.code_hash },
    currency: row.currency_code,
    status: row.status,
    issuanceEntryId: row.issuance_entry_id,
    issuanceBusinessKey: row.issuance_business_key,
    issuedAmount: Money.fromMinor(row.issued_amount_minor, row.currency_code),
    issuedOrderId: row.issued_order_id ?? undefined,
    issuedLineId: row.issued_line_id ?? undefined,
    purchaserCustomerId: row.purchaser_customer_id ?? undefined,
    createdAt: row.created_at,
    disabledAt: row.disabled_at ?? undefined,
  };
  assertGiftCardCodeHash(account.codeHash);
  assertGiftCardCurrency(account.currency);
  assertGiftCardMoney(account.issuedAmount, { positive: true });
  return account;
}

function mapReservation(row: ReservationRow): GiftCardReservation {
  return {
    id: row.id,
    giftCardId: row.gift_card_id,
    requestKey: row.request_key,
    quoteFingerprint: row.quote_fingerprint,
    requestedAmount: Money.fromMinor(row.requested_amount_minor, row.currency_code),
    amount: Money.fromMinor(row.amount_minor, row.currency_code),
    reservedAt: row.reserved_at,
    expiresAt: row.expires_at,
    committedOrderId: row.committed_order_id ?? undefined,
    committedAt: row.committed_at ?? undefined,
    releasedAt: row.released_at ?? undefined,
    releaseReason: row.release_reason ?? undefined,
  };
}

function mapLedger(row: LedgerRow): GiftCardLedgerEntry {
  return {
    id: row.id,
    giftCardId: row.gift_card_id,
    entryType: row.entry_type,
    amountDelta: Money.fromMinor(row.amount_delta_minor, row.currency_code),
    businessKey: row.business_key,
    orderId: row.order_id ?? undefined,
    reservationId: row.reservation_id ?? undefined,
    relatedEntryId: row.related_entry_id ?? undefined,
    createdAt: row.created_at,
  };
}

function sameAccount(account: GiftCardAccount, input: IssueGiftCardInput): boolean {
  return account.id === input.id
    && account.codeHash.keyVersion === input.codeHash.keyVersion
    && account.codeHash.digest === input.codeHash.digest
    && account.issuedAmount.equals(input.amount)
    && account.issuanceEntryId === input.id
    && account.issuanceBusinessKey === giftCardIssuanceBusinessKey(input.id)
    && account.issuedOrderId === input.issuedOrderId
    && account.issuedLineId === input.issuedLineId
    && account.purchaserCustomerId === input.purchaserCustomerId
    && account.createdAt === input.createdAt;
}

function sameReservation(reservation: GiftCardReservation, input: ReserveGiftCardInput): boolean {
  return reservation.id === input.id
    && reservation.giftCardId === input.giftCardId
    && reservation.requestKey === input.requestKey
    && reservation.quoteFingerprint === input.quoteFingerprint
    && reservation.requestedAmount.equals(input.requestedAmount);
}

function assertGiftCardActor(value: unknown): asserts value is Actor {
  if (
    typeof value !== "object" || value === null
    || !["admin", "service", "system"].includes((value as { type?: unknown }).type as string)
    || !("id" in value)
    || ((value as { id: unknown }).id !== null && typeof (value as { id: unknown }).id !== "string")
  ) {
    throw new TypeError("gift-card actor must be { type: admin|service|system, id: string | null }");
  }
}

function assertOrderId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 200 || value.trim() !== value) {
    throw new TypeError("gift-card order id must be a bounded identifier");
  }
}

function availableBalanceExpression(accountAlias: string, nowPlaceholder = "?"): string {
  return `(COALESCE((
    SELECT SUM(entry.amount_delta_minor)
    FROM gift_card_ledger_entries entry
    WHERE entry.gift_card_id = ${accountAlias}.id
  ), 0) - COALESCE((
    SELECT SUM(reservation.amount_minor)
    FROM gift_card_reservations reservation
    WHERE reservation.gift_card_id = ${accountAlias}.id
      AND reservation.released_at IS NULL
      AND (
        reservation.committed_at IS NOT NULL
        OR reservation.expires_at > ${nowPlaceholder}
      )
      AND NOT EXISTS (
        SELECT 1 FROM gift_card_ledger_entries settlement
        WHERE settlement.reservation_id = reservation.id
          AND settlement.entry_type = 'redemption'
      )
  ), 0))`;
}

export interface OutstandingGiftCardBalances {
  /**
   * Summed available balance, in minor units, across every card still holding
   * value: every active card, plus any disabled card whose balance has not yet
   * been reissued or written off (WR-07 — that balance is still owed).
   */
  outstandingMinor: number;
  /** How many cards (active or disabled) still carry a positive available balance. */
  cardsWithBalance: number;
  /**
   * Reservations that still hold value: unreleased, not yet settled, and
   * either committed or unexpired. Committed-but-unsettled rows are counted —
   * that money is owed even though the available-balance expression has
   * already subtracted it.
   */
  openReservations: number;
  /**
   * The face value those reservations are holding, in minor units.
   *
   * `outstandingMinor` cannot include it: the available-balance expression has
   * already subtracted a committed, unsettled reservation, so that money reads
   * as zero on the card. The two numbers are measured over different
   * populations and only mean something when reported side by side — "$X
   * available plus $Y held" — which is what stops an operator being shown
   * "$0.00 outstanding" beside a nonzero reservation count.
   */
  heldMinor: number;
  /** `null` when no card is active or holds value; callers pick their own default. */
  currency: string | null;
  /**
   * How many distinct currencies the counted cards span. `outstandingMinor` is
   * a bare SUM of minor units, so it is only a real total when this is 1 —
   * above that it is a signal that money exists, not an amount anyone can
   * format. Callers must not print it as `currency`.
   */
  currencyCount: number;
}

interface OutstandingTotalsRow {
  outstanding_minor: number | null;
  cards_with_balance: number | null;
  currency: string | null;
  currency_count: number | null;
}

interface OpenReservationsRow {
  open_reservations: number | null;
  held_minor: number | null;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * How much stored value is outstanding right now, in one D1 round trip.
 *
 * Read-only. This is the measurement behind the honor guard (D-04, D-05): it
 * runs from the five-minute cron tick and from the admin gift-card page, never
 * from a request path — request-time code reads the small `admin_settings`
 * record this feeds instead (D-06).
 *
 * The balance half reuses `availableBalanceExpression`, the same SQL
 * `readBalance` and the reservation guard trigger use, so there is exactly one
 * definition of "available" in the codebase.
 *
 * `outstandingMinor` sums minor units across every card still holding value
 * without grouping, and `currency` is whichever code sorts first. In a single-currency
 * store — which is what `storeDefaults.commerce.currency` describes — that is a
 * real total. In a store holding both USD and EUR cards it is not a total of
 * anything, so `currencyCount` is reported alongside it and callers are
 * expected to refuse to format the number when it is above 1.
 */
export async function sumOutstandingGiftCardBalances(
  database: D1Database,
  nowSeconds: number,
): Promise<OutstandingGiftCardBalances> {
  const balance = availableBalanceExpression("account");
  const batched = await database.batch([
    // `balance` is interpolated three times, so this statement carries three
    // `?` placeholders and `nowSeconds` binds three times, left to right: the
    // one inside the SUM column, the one inside the CASE column, then the one
    // in the WHERE clause.
    //
    // Which cards count (WR-07): every active card, and every disabled card
    // that still has an available balance. Disabling a card stops redemption
    // but does not forgive the money on it — until an admin reissues it (D-05)
    // or writes it off, that balance is a liability the store still owes, and
    // the honor guard exists to keep the admin surface reachable while any
    // such liability exists. Scoping this to active cards alone would let the
    // guard read "no balances" the moment the last card was disabled, switch
    // honoring off, and 404 the very detail page the reissue button lives on.
    // A disabled card that has been drained (by reissue) reads zero here and
    // drops out, so a reissued balance is counted exactly once, on the new card.
    database.prepare(`SELECT
        COALESCE(SUM(${balance}), 0) AS outstanding_minor,
        COALESCE(SUM(CASE WHEN ${balance} > 0 THEN 1 ELSE 0 END), 0) AS cards_with_balance,
        MIN(account.currency_code) AS currency,
        COUNT(DISTINCT account.currency_code) AS currency_count
      FROM gift_card_accounts account
      WHERE account.status = 'active' OR ${balance} > 0`)
      .bind(/* SUM(...) */ nowSeconds, /* CASE WHEN ... */ nowSeconds, /* WHERE ... */ nowSeconds),
    // The same "still holding value" clause the balance expression uses, so
    // there is one definition of it in the codebase. It has to be the same
    // one: a reservation that is committed but whose redemption ledger entry
    // has not landed yet is subtracted from the card's available balance, so
    // it contributes 0 to `outstanding_minor`. If this count were narrower
    // than the balance clause, that money would be invisible to both halves
    // of the measurement and the guard would report "no balances" while an
    // order is mid-settlement.
    //
    // Scoped to accounts the same way the balance half is, with the same
    // reasoning about disabled cards (WR-07 above):
    //
    //   **A disabled card that still holds a committed, unsettled reservation
    //   is still money, and is still counted here.**
    //
    // Scoping this purely to active accounts would re-open the exact hole the
    // committed-and-unsettled clause was added to close, narrowed to one card
    // state. Phase 14's disable action permits active -> disabled with no check
    // for an outstanding reservation (`gift_card_accounts_status_transition_guard`
    // does not require one), and neither `settleReservation` nor
    // `restoreRedemption` checks `account.status`. Only `reserve` requires an
    // active account — so "a disabled card cannot redeem anyway" is true of
    // *new* reservations and false of ones already in flight. Disabling a card
    // mid-settlement would otherwise drop the measurement to zero, switch
    // honoring off, and strand the redemption on every retry.
    //
    // Uncommitted reservations against a disabled card are excluded: those
    // hold no money the store has taken yet, and they expire on their own.
    database.prepare(`SELECT
        COUNT(*) AS open_reservations,
        COALESCE(SUM(reservation.amount_minor), 0) AS held_minor
      FROM gift_card_reservations reservation
      JOIN gift_card_accounts account ON account.id = reservation.gift_card_id
      WHERE (account.status = 'active' OR reservation.committed_at IS NOT NULL)
        AND reservation.released_at IS NULL
        AND (
          reservation.committed_at IS NOT NULL
          OR reservation.expires_at > ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM gift_card_ledger_entries settlement
          WHERE settlement.reservation_id = reservation.id
            AND settlement.entry_type = 'redemption'
        )`)
      .bind(nowSeconds),
  ]);
  const totals = (batched[0]?.results?.[0] ?? null) as OutstandingTotalsRow | null;
  const open = (batched[1]?.results?.[0] ?? null) as OpenReservationsRow | null;
  return {
    outstandingMinor: toCount(totals?.outstanding_minor),
    cardsWithBalance: toCount(totals?.cards_with_balance),
    openReservations: toCount(open?.open_reservations),
    heldMinor: toCount(open?.held_minor),
    currency: typeof totals?.currency === "string" ? totals.currency : null,
    currencyCount: toCount(totals?.currency_count),
  };
}

export function createGiftCardRepository(database: D1Database) {
  const findAccountById = async (id: string): Promise<GiftCardAccount | undefined> => {
    assertGiftCardId(id);
    const row = await database.prepare(`${ACCOUNT_SELECT} WHERE id = ? LIMIT 1`)
      .bind(id).first<AccountRow>();
    return row ? mapAccount(row) : undefined;
  };

  const findReservationById = async (id: string): Promise<GiftCardReservation | undefined> => {
    assertGiftCardId(id, "gift-card reservation id");
    const row = await database.prepare(`${RESERVATION_SELECT} WHERE id = ? LIMIT 1`)
      .bind(id).first<ReservationRow>();
    return row ? mapReservation(row) : undefined;
  };

  // Local const (not object-method shorthand) so `reissue` below can call it by
  // closure reference — matches the `findAccountById`/`findReservationById`
  // idiom already used in this factory, and avoids relying on `this` binding
  // if a caller destructures the returned object.
  /**
   * The three idempotent INSERTs that make up an issuance — account, issuance
   * ledger entry, and (optionally) the pending delivery row. Split out of
   * `issueAccount` so `reissue` can put the same statements into one larger
   * `database.batch()` beside its drain adjustment and audit events (D-06,
   * D-19): the batch is what makes the whole reissue all-or-nothing.
   */
  const issueAccountStatements = (input: IssueGiftCardInput, businessKey: string): D1PreparedStatement[] => [
        database.prepare(`INSERT INTO gift_card_accounts (
          id, code_hash, code_hash_version, currency_code, status,
          issuance_entry_id, issuance_business_key, issued_amount_minor,
          issued_order_id, issued_line_id, purchaser_customer_id, created_at, disabled_at,
          code_suffix
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT DO NOTHING`).bind(
          input.id,
          input.codeHash.digest,
          input.codeHash.keyVersion,
          input.amount.currency,
          input.id,
          businessKey,
          input.amount.toMinorUnits(),
          input.issuedOrderId ?? null,
          input.issuedLineId ?? null,
          input.purchaserCustomerId ?? null,
          input.createdAt,
          input.codeSuffix ?? null,
        ),
        database.prepare(`INSERT INTO gift_card_ledger_entries (
          id, gift_card_id, currency_code, entry_type, amount_delta_minor,
          business_key, order_id, reservation_id, related_entry_id, created_at
        ) SELECT issuance_entry_id, id, currency_code, 'issuance', issued_amount_minor,
          issuance_business_key, issued_order_id, NULL, NULL, created_at
        FROM gift_card_accounts
        WHERE id = ? AND code_hash = ? AND code_hash_version = ?
          AND currency_code = ? AND issuance_entry_id = ?
          AND issuance_business_key = ? AND issued_amount_minor = ?
          AND issued_order_id IS ? AND issued_line_id IS ?
          AND purchaser_customer_id IS ? AND created_at = ?
        ON CONFLICT DO NOTHING`).bind(
          input.id,
          input.codeHash.digest,
          input.codeHash.keyVersion,
          input.amount.currency,
          input.id,
          businessKey,
          input.amount.toMinorUnits(),
          input.issuedOrderId ?? null,
          input.issuedLineId ?? null,
          input.purchaserCustomerId ?? null,
          input.createdAt,
        ),
        ...(input.delivery ? [database.prepare(`INSERT INTO gift_card_deliveries (
          id, gift_card_id, order_id, order_line_id, recipient_email, recipient_name,
          email_idempotency_key, status, attempt_count, deliver_after, claim_token, lease_expires_at,
          code_ciphertext, code_nonce, code_key_version, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(gift_card_id) DO NOTHING`).bind(
          input.delivery.id,
          input.id,
          input.issuedOrderId ?? null,
          input.issuedLineId ?? null,
          input.delivery.recipientEmail,
          input.delivery.recipientName ?? null,
          input.delivery.emailIdempotencyKey,
          input.delivery.deliverAfter ?? 0,
          input.delivery.codeCiphertext,
          input.delivery.codeNonce,
          input.delivery.codeKeyVersion,
          input.createdAt,
          input.createdAt,
        )] : []),
  ];

  /**
   * Post-write validation shared by `issueAccount` and `reissue`: the durable
   * rows must match the input exactly, or a retry with changed facts (or a
   * colliding id) is surfaced as a conflict rather than silently accepted.
   */
  const verifyIssuedAccount = async (input: IssueGiftCardInput, businessKey: string): Promise<{
    account: GiftCardAccount;
    issuance: GiftCardLedgerEntry;
  }> => {
      const account = await findAccountById(input.id);
      const issuanceRow = await database.prepare(
        `${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`,
      ).bind(businessKey).first<LedgerRow>();
      if (!account || !issuanceRow || !sameAccount(account, input)) {
        throw new GiftCardConflictError("Gift-card issuance identity conflicts with durable state");
      }
      const issuance = mapLedger(issuanceRow);
      if (
        issuance.id !== input.id
        || issuance.giftCardId !== input.id
        || issuance.entryType !== "issuance"
        || !issuance.amountDelta.equals(input.amount)
        || issuance.orderId !== input.issuedOrderId
      ) {
        throw new GiftCardConflictError("Gift-card issuance ledger conflicts with durable state");
      }
      if (input.delivery) {
        const delivery = await database.prepare(`SELECT id, gift_card_id, recipient_email,
          recipient_name, email_idempotency_key, code_ciphertext, code_nonce, code_key_version
          FROM gift_card_deliveries WHERE gift_card_id = ? LIMIT 1`).bind(input.id).first<{
            id: string; gift_card_id: string; recipient_email: string; recipient_name: string | null;
            email_idempotency_key: string; code_ciphertext: string | null; code_nonce: string | null;
            code_key_version: number | null;
          }>();
        if (!delivery || delivery.id !== input.delivery.id || delivery.gift_card_id !== input.id ||
          delivery.recipient_email !== input.delivery.recipientEmail ||
          delivery.recipient_name !== (input.delivery.recipientName ?? null) ||
          delivery.email_idempotency_key !== input.delivery.emailIdempotencyKey ||
          delivery.code_ciphertext !== input.delivery.codeCiphertext ||
          delivery.code_nonce !== input.delivery.codeNonce ||
          delivery.code_key_version !== input.delivery.codeKeyVersion) {
          throw new GiftCardConflictError('Gift-card delivery conflicts with durable state');
        }
      }
      return { account, issuance };
  };

  const issueAccount = async (input: IssueGiftCardInput): Promise<{
    created: boolean;
    account: GiftCardAccount;
    issuance: GiftCardLedgerEntry;
  }> => {
      assertIssueGiftCardInput(input);
      const businessKey = giftCardIssuanceBusinessKey(input.id);
      const result = await database.batch(issueAccountStatements(input, businessKey));
      const { account, issuance } = await verifyIssuedAccount(input, businessKey);
      return { created: (result[0]?.meta.changes ?? 0) === 1, account, issuance };
  };

  const readBalance = async (giftCardId: string, now: number): Promise<GiftCardBalance | undefined> => {
    assertGiftCardId(giftCardId);
    assertGiftCardEpoch(now, "gift-card balance time");
    const row = await database.prepare(`SELECT account.currency_code,
      COALESCE((SELECT SUM(entry.amount_delta_minor)
        FROM gift_card_ledger_entries entry
        WHERE entry.gift_card_id = account.id), 0) AS ledger_balance_minor,
      COALESCE((SELECT SUM(reservation.amount_minor)
        FROM gift_card_reservations reservation
        WHERE reservation.gift_card_id = account.id
          AND reservation.released_at IS NULL
          AND (reservation.committed_at IS NOT NULL OR reservation.expires_at > ?)
          AND NOT EXISTS (
            SELECT 1 FROM gift_card_ledger_entries settlement
            WHERE settlement.reservation_id = reservation.id
              AND settlement.entry_type = 'redemption'
          )), 0) AS held_amount_minor
      FROM gift_card_accounts account WHERE account.id = ? LIMIT 1`)
      .bind(now, giftCardId).first<BalanceRow>();
    if (!row) return undefined;
    const ledgerBalance = Money.fromMinor(row.ledger_balance_minor, row.currency_code);
    const heldAmount = Money.fromMinor(row.held_amount_minor, row.currency_code);
    return {
      ledgerBalance,
      heldAmount,
      availableBalance: ledgerBalance.subtract(heldAmount),
    };
  };

  /**
   * D-08: the delivery id and recipient address behind a card, for the
   * resend and reissue routes. Deliberately narrow — only the two columns
   * neither route needs a second query for — never the ciphertext columns
   * `resendGiftCardDelivery`/`revealGiftCardDeliveryCode`
   * (`lib/services/gift-card-fulfillment.ts`) already own reading.
   */
  const findDeliveryByGiftCardId = async (
    giftCardId: string,
  ): Promise<{ id: string; recipientEmail: string } | undefined> => {
    assertGiftCardId(giftCardId);
    const row = await database.prepare(`SELECT id, recipient_email
      FROM gift_card_deliveries WHERE gift_card_id = ? LIMIT 1`)
      .bind(giftCardId).first<{ id: string; recipient_email: string }>();
    return row ? { id: row.id, recipientEmail: row.recipient_email } : undefined;
  };

  /**
   * D-10: every reservation for a card, newest first, each carrying whether a
   * `redemption` ledger entry has settled it — via LEFT JOIN so the caller (the
   * reissue guard, the release-hold route, the timeline) never issues a second
   * query per reservation to learn that fact.
   */
  const findReservations = async (giftCardId: string): Promise<GiftCardReservationWithSettlement[]> => {
    assertGiftCardId(giftCardId);
    const { results } = await database.prepare(`SELECT
        reservation.id, reservation.gift_card_id, reservation.currency_code,
        reservation.request_key, reservation.quote_fingerprint,
        reservation.requested_amount_minor, reservation.amount_minor,
        reservation.reserved_at, reservation.expires_at,
        reservation.committed_order_id, reservation.committed_at,
        reservation.released_at, reservation.release_reason,
        CASE WHEN settlement.id IS NOT NULL THEN 1 ELSE 0 END AS settled
      FROM gift_card_reservations reservation
      LEFT JOIN gift_card_ledger_entries settlement
        ON settlement.reservation_id = reservation.id AND settlement.entry_type = 'redemption'
      WHERE reservation.gift_card_id = ?
      ORDER BY reservation.reserved_at DESC, reservation.id DESC`)
      .bind(giftCardId).all<ReservationRow & { settled: number }>();
    return results.map((row) => ({ ...mapReservation(row), settled: row.settled === 1 }));
  };

  /** D-05: the one-way active -> disabled transition; retried requests are safe. */
  const disableAccount = async (args: {
    giftCardId: string;
    disabledAt: number;
  }): Promise<{ changed: boolean; account: GiftCardAccount }> => {
    assertGiftCardId(args.giftCardId);
    assertGiftCardEpoch(args.disabledAt, "gift-card disable time");
    const updated = await database.prepare(`UPDATE gift_card_accounts
      SET status = 'disabled', disabled_at = ?
      WHERE id = ? AND status = 'active'
      RETURNING id`).bind(args.disabledAt, args.giftCardId).first<{ id: string }>();
    const account = await findAccountById(args.giftCardId);
    if (!account) throw new GiftCardUnavailableError("Gift card is unavailable");
    return { changed: updated?.id === args.giftCardId, account };
  };

  /** D-09: only from `needs_review`; all four CHECK-coupled columns move together. */
  const requeueDelivery = async (args: {
    giftCardId: string;
    now: number;
  }): Promise<{ requeued: boolean; deliveryId: string | undefined }> => {
    assertGiftCardId(args.giftCardId);
    assertGiftCardEpoch(args.now, "gift-card requeue time");
    const row = await database.prepare(`UPDATE gift_card_deliveries
      SET status = 'pending', completed_at = NULL, claim_token = NULL, lease_expires_at = NULL,
          attempt_count = 0, deliver_after = ?, updated_at = ?
      WHERE gift_card_id = ? AND status = 'needs_review'
      RETURNING id`).bind(args.now, args.now, args.giftCardId).first<{ id: string }>();
    return { requeued: Boolean(row), deliveryId: row?.id };
  };

  /**
   * A signed ledger adjustment, modelled line for line on `restoreRedemption`'s
   * idempotent single-INSERT idiom. `reservation_id` and `related_entry_id` are
   * always NULL — the 0022 entry-type CHECK requires that for `adjustment`.
   * Never pre-checks overdraft: `gift_card_ledger_balance_guard` is the safety
   * net and its rejection is the correct failure (D-06).
   */
  const writeAdjustment = async (args: {
    giftCardId: string;
    amount: Money;
    businessKey: string;
    entryId?: string;
    createdAt: number;
  }): Promise<{ created: boolean; entry: GiftCardLedgerEntry }> => {
    assertGiftCardId(args.giftCardId);
    if (!(args.amount instanceof Money)) throw new TypeError("gift-card adjustment amount must be Money");
    assertGiftCardCurrency(args.amount.currency);
    assertGiftCardBusinessKey(args.businessKey);
    assertGiftCardEpoch(args.createdAt, "gift-card adjustment time");
    const entryId = args.entryId ?? `gift_ledger_${crypto.randomUUID()}`;
    assertGiftCardId(entryId, "gift-card ledger entry id");

    const existing = async (): Promise<GiftCardLedgerEntry | undefined> => {
      const row = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
        .bind(args.businessKey).first<LedgerRow>();
      return row ? mapLedger(row) : undefined;
    };
    const validate = (entry: GiftCardLedgerEntry): GiftCardLedgerEntry => {
      if (
        entry.entryType !== "adjustment"
        || entry.giftCardId !== args.giftCardId
        || !entry.amountDelta.equals(args.amount)
      ) throw new GiftCardConflictError("Gift-card adjustment conflicts with durable state");
      return entry;
    };

    const prior = await existing();
    if (prior) return { created: false, entry: validate(prior) };

    let inserted: { id: string } | null;
    try {
      inserted = await database.prepare(`INSERT INTO gift_card_ledger_entries (
        id, gift_card_id, currency_code, entry_type, amount_delta_minor,
        business_key, order_id, reservation_id, related_entry_id, created_at
      ) VALUES (?, ?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT DO NOTHING RETURNING id`).bind(
        entryId,
        args.giftCardId,
        args.amount.currency,
        args.amount.toMinorUnits(),
        args.businessKey,
        args.createdAt,
      ).first<{ id: string }>();
    } catch {
      const raced = await existing();
      if (raced) return { created: false, entry: validate(raced) };
      throw new GiftCardConflictError("Gift-card adjustment could not be written");
    }
    const entry = await existing();
    if (!entry) throw new GiftCardConflictError("Gift-card adjustment could not be written");
    return { created: inserted?.id === entryId, entry: validate(entry) };
  };

  /**
   * One raw `INSERT INTO gift_card_events` statement for a batch. Mirrors the
   * row `appendGiftCardEvent` (`./events`) writes, but as a prepared statement
   * so it can share a transaction with the money it describes. Details are
   * run through the same forbidden-key check before binding (D-03/D-14).
   * `onceOnly` makes the INSERT a no-op when the card already carries an
   * event of that type, so an idempotent issuance retry cannot double it.
   */
  const giftCardEventStatement = (args: {
    giftCardId: string;
    eventType: GiftCardEventType;
    actor: Actor;
    details: Record<string, unknown>;
    createdAt: number;
    onceOnly?: boolean;
  }): D1PreparedStatement => {
    assertGiftCardEventDetails(args.details);
    assertGiftCardActor(args.actor);
    const values = [
      crypto.randomUUID(),
      args.giftCardId,
      args.eventType,
      args.actor.type,
      args.actor.id,
      JSON.stringify(args.details),
      args.createdAt,
    ];
    if (args.onceOnly) {
      return database.prepare(`INSERT INTO gift_card_events (
        id, gift_card_id, event_type, actor_type, actor_id, details, created_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM gift_card_events existing
        WHERE existing.gift_card_id = ? AND existing.event_type = ?
      )`).bind(...values, args.giftCardId, args.eventType);
    }
    return database.prepare(`INSERT INTO gift_card_events (
      id, gift_card_id, event_type, actor_type, actor_id, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(...values);
  };

  /**
   * A-3: an issuance whose audit events land in the same D1 batch as the
   * account, ledger and delivery rows, so a card can never exist without the
   * event that says where it came from (`admin_created`), nor the event
   * without the card. Same shape `reissue` uses for its pair.
   */
  const issueAccountWithEvents = async (
    input: IssueGiftCardInput,
    events: readonly GiftCardBatchedEvent[],
  ): Promise<{ created: boolean; account: GiftCardAccount; issuance: GiftCardLedgerEntry }> => {
    assertIssueGiftCardInput(input);
    const businessKey = giftCardIssuanceBusinessKey(input.id);
    const result = await database.batch([
      ...issueAccountStatements(input, businessKey),
      ...events.map((event) => giftCardEventStatement({
        giftCardId: input.id,
        eventType: event.eventType,
        actor: event.actor,
        details: event.details,
        createdAt: event.createdAt ?? input.createdAt,
        onceOnly: event.onceOnly ?? true,
      })),
    ]);
    const { account, issuance } = await verifyIssuedAccount(input, businessKey);
    return { created: (result[0]?.meta.changes ?? 0) === 1, account, issuance };
  };

  /**
   * Drain a disabled card's available balance into a negative adjustment,
   * issue a new card for the same amount, and write the paired
   * `reissued`/`reissued_from` audit events — all in ONE `database.batch()`,
   * which D1 runs as a single transaction (D-06, D-19). Either every row lands
   * or none does: a CHECK failure on the delivery row, a UNIQUE collision, or
   * a dropped connection can no longer leave the old card drained with no new
   * card to show for it.
   *
   * Idempotency comes from `giftCardReissueId` — a deterministic new-card id —
   * rather than a custom business key on `issueAccount`, which derives its own
   * from the id it is given (RESEARCH Pitfall 2). A retry converges on what
   * already happened *before* re-reading the balance: once the new card and
   * the drain adjustment both exist the answer is "already reissued", and a
   * half-applied state left by a pre-batch deploy is surfaced for repair
   * rather than guessed at. The D-01 partial UNIQUE index on `reissued` is the
   * database-level once-only guarantee: a second batch for the same card is
   * rejected as a whole, adjustment and issuance included.
   */
  const reissue = async (args: {
    oldGiftCardId: string;
    now: number;
    actor: Actor;
    codeHash: GiftCardCodeHash;
    codeSuffix?: string;
    delivery?: IssueGiftCardInput["delivery"];
  }): Promise<{ created: boolean; newGiftCardId: string; amount: Money }> => {
    assertGiftCardId(args.oldGiftCardId, "gift-card id");
    assertGiftCardEpoch(args.now, "gift-card reissue time");
    assertGiftCardCodeHash(args.codeHash);
    if (args.codeSuffix !== undefined) assertGiftCardCodeSuffix(args.codeSuffix);
    assertGiftCardActor(args.actor);

    const oldAccount = await findAccountById(args.oldGiftCardId);
    if (!oldAccount) throw new GiftCardUnavailableError("Gift card is unavailable");
    if (oldAccount.status !== "disabled") {
      throw new GiftCardConflictError("Gift card must be disabled before it can be reissued");
    }

    const reservations = await findReservations(args.oldGiftCardId);
    for (const candidate of reservations) {
      const classification = classifyGiftCardReservation(candidate, args.now);
      if (classification === "open" || classification === "committed_unsettled") {
        throw new GiftCardConflictError(
          `Gift card cannot be reissued while a reservation is ${classification}`,
        );
      }
    }

    // Converge on prior state first, never on a balance that has already moved.
    const newGiftCardId = await giftCardReissueId(args.oldGiftCardId);
    const adjustmentKey = giftCardReissueAdjustmentBusinessKey(args.oldGiftCardId);
    const priorNewAccount = await findAccountById(newGiftCardId);
    const priorAdjustment = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
      .bind(adjustmentKey).first<LedgerRow>();
    if (priorNewAccount && priorAdjustment) {
      throw new GiftCardConflictError("Gift card has already been reissued");
    }
    if (priorNewAccount || priorAdjustment) {
      throw new GiftCardConflictError("Gift card reissue is in an inconsistent state and needs manual repair");
    }

    const balance = await readBalance(args.oldGiftCardId, args.now);
    if (!balance) throw new GiftCardUnavailableError("Gift card is unavailable");
    const amount = balance.availableBalance;
    if (!amount.gt(Money.zero(amount.currency))) {
      throw new GiftCardConflictError("Gift card has no available balance to reissue");
    }

    const issueInput: IssueGiftCardInput = {
      id: newGiftCardId,
      codeHash: args.codeHash,
      amount,
      createdAt: args.now,
      ...(args.codeSuffix !== undefined ? { codeSuffix: args.codeSuffix } : {}),
      ...(args.delivery ? { delivery: args.delivery } : {}),
    };
    assertIssueGiftCardInput(issueInput);
    const issuanceKey = giftCardIssuanceBusinessKey(newGiftCardId);
    const adjustmentEntryId = `gift_ledger_${crypto.randomUUID()}`;
    assertGiftCardId(adjustmentEntryId, "gift-card ledger entry id");

    const statements = [
      // No ON CONFLICT clause on purpose: the pre-check above already proved
      // this key is absent, so a collision here is a race with another
      // reissue of the same card and must abort the whole batch.
      database.prepare(`INSERT INTO gift_card_ledger_entries (
        id, gift_card_id, currency_code, entry_type, amount_delta_minor,
        business_key, order_id, reservation_id, related_entry_id, created_at
      ) VALUES (?, ?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, ?)`).bind(
        adjustmentEntryId,
        args.oldGiftCardId,
        amount.currency,
        amount.negate().toMinorUnits(),
        adjustmentKey,
        args.now,
      ),
      ...issueAccountStatements(issueInput, issuanceKey),
      giftCardEventStatement({
        giftCardId: args.oldGiftCardId,
        eventType: "reissued",
        actor: args.actor,
        details: {
          to_gift_card_id: newGiftCardId,
          amount_minor: amount.toMinorUnits(),
          ...(args.delivery ? { recipient_email: args.delivery.recipientEmail } : {}),
        },
        createdAt: args.now,
      }),
      giftCardEventStatement({
        giftCardId: newGiftCardId,
        eventType: "reissued_from",
        actor: args.actor,
        details: { from_gift_card_id: args.oldGiftCardId },
        createdAt: args.now,
      }),
    ];

    let result: D1Result[];
    try {
      result = await database.batch(statements);
    } catch (error) {
      // IN-10: two admins reissuing the same card at once both pass the
      // pre-check; the loser's batch aborts on the ledger's UNIQUE
      // business_key (or the D-01 partial index) with a raw D1 error. Nothing
      // of the loser's landed, so re-probe: if the winner's rows are now
      // there, this is D-06's "already reissued" 409, not a 503.
      const [racedAccount, racedAdjustment] = await Promise.all([
        findAccountById(newGiftCardId),
        database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`).bind(adjustmentKey).first<LedgerRow>(),
      ]);
      if (racedAccount && racedAdjustment) {
        throw new GiftCardConflictError("Gift card has already been reissued");
      }
      throw error;
    }

    await verifyIssuedAccount(issueInput, issuanceKey);
    const adjustmentRow = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
      .bind(adjustmentKey).first<LedgerRow>();
    const adjustment = adjustmentRow ? mapLedger(adjustmentRow) : undefined;
    if (
      !adjustment
      || adjustment.entryType !== "adjustment"
      || adjustment.giftCardId !== args.oldGiftCardId
      || !adjustment.amountDelta.equals(amount.negate())
    ) {
      throw new GiftCardConflictError("Gift-card reissue adjustment conflicts with durable state");
    }

    return {
      created: (result[0]?.meta.changes ?? 0) === 1,
      newGiftCardId,
      amount,
    };
  };

  return {
    findAccountById,

    async findAccountByCodeHash(codeHash: GiftCardCodeHash): Promise<GiftCardAccount | undefined> {
      assertGiftCardCodeHash(codeHash);
      const row = await database.prepare(
        `${ACCOUNT_SELECT} WHERE code_hash_version = ? AND code_hash = ? LIMIT 1`,
      ).bind(codeHash.keyVersion, codeHash.digest).first<AccountRow>();
      return row ? mapAccount(row) : undefined;
    },

    issueAccount,
    issueAccountWithEvents,
    readBalance,
    disableAccount,
    findDeliveryByGiftCardId,
    findReservations,
    requeueDelivery,
    writeAdjustment,
    reissue,

    async reserve(input: ReserveGiftCardInput): Promise<GiftCardReservationResult> {
      assertReserveGiftCardInput(input);
      const availableForCase = availableBalanceExpression("account");
      const availableForWhere = availableBalanceExpression("account");
      const inserted = await database.prepare(`INSERT INTO gift_card_reservations (
        id, gift_card_id, currency_code, request_key, quote_fingerprint,
        requested_amount_minor, amount_minor, reserved_at, expires_at,
        committed_order_id, committed_at, released_at, release_reason
      ) SELECT ?, account.id, account.currency_code, ?, ?, ?,
        CASE WHEN ${availableForCase} < ? THEN ${availableForCase} ELSE ? END,
        ?, ?, NULL, NULL, NULL, NULL
      FROM gift_card_accounts account
      WHERE account.id = ? AND account.currency_code = ? AND account.status = 'active'
        AND ${availableForWhere} > 0
      ON CONFLICT DO NOTHING
      RETURNING id`).bind(
        input.id,
        input.requestKey,
        input.quoteFingerprint,
        input.requestedAmount.toMinorUnits(),
        input.reservedAt,
        input.requestedAmount.toMinorUnits(),
        input.reservedAt,
        input.requestedAmount.toMinorUnits(),
        input.reservedAt,
        input.expiresAt,
        input.giftCardId,
        input.requestedAmount.currency,
        input.reservedAt,
      ).first<{ id: string }>();
      const row = await database.prepare(`${RESERVATION_SELECT} WHERE request_key = ? LIMIT 1`)
        .bind(input.requestKey).first<ReservationRow>();
      if (!row) {
        const identityCollision = await findReservationById(input.id);
        if (identityCollision) {
          throw new GiftCardConflictError("Gift-card reservation identity conflicts with durable state");
        }
        return { available: false };
      }
      const reservation = mapReservation(row);
      if (!sameReservation(reservation, input)) {
        throw new GiftCardConflictError("Gift-card reservation request conflicts with durable state");
      }
      return { available: true, created: inserted?.id === input.id, reservation };
    },

    findReservationById,

    async commitReservation(args: {
      reservationId: string;
      orderId: string;
      expectedAmount: Money;
      committedAt: number;
    }): Promise<GiftCardReservation> {
      assertGiftCardId(args.reservationId, "gift-card reservation id");
      assertOrderId(args.orderId);
      assertGiftCardMoney(args.expectedAmount, { positive: true });
      assertGiftCardEpoch(args.committedAt, "gift-card commitment time");
      const row = await database.prepare(`UPDATE gift_card_reservations
        SET committed_order_id = ?, committed_at = COALESCE(committed_at, ?)
        WHERE id = ? AND currency_code = ? AND amount_minor = ?
          AND released_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM gift_card_ledger_entries
            WHERE reservation_id = gift_card_reservations.id
              AND entry_type = 'redemption'
          )
          AND (
            (committed_order_id IS NULL AND committed_at IS NULL AND expires_at > ?)
            OR committed_order_id = ?
          )
        RETURNING id, gift_card_id, currency_code, request_key,
          quote_fingerprint, requested_amount_minor, amount_minor, reserved_at,
          expires_at, committed_order_id, committed_at, released_at, release_reason`)
        .bind(
          args.orderId,
          args.committedAt,
          args.reservationId,
          args.expectedAmount.currency,
          args.expectedAmount.toMinorUnits(),
          args.committedAt,
          args.orderId,
        ).first<ReservationRow>();
      if (row) return mapReservation(row);
      const existing = await findReservationById(args.reservationId);
      if (
        existing
        && existing.committedOrderId === args.orderId
        && existing.amount.equals(args.expectedAmount)
        && existing.releasedAt === undefined
      ) return existing;
      if (existing?.committedOrderId !== undefined) {
        throw new GiftCardConflictError("Gift-card reservation is committed to a different order");
      }
      if (existing?.releasedAt !== undefined || (existing && existing.expiresAt <= args.committedAt)) {
        throw new GiftCardUnavailableError("Gift-card reservation is no longer available");
      }
      throw new GiftCardConflictError("Gift-card reservation cannot be committed to this order");
    },

    async settleReservation(args: {
      reservationId: string;
      orderId: string;
      settledAt: number;
      entryId?: string;
    }): Promise<{ created: boolean; entry: GiftCardLedgerEntry }> {
      assertGiftCardId(args.reservationId, "gift-card reservation id");
      assertOrderId(args.orderId);
      assertGiftCardEpoch(args.settledAt, "gift-card settlement time");
      const entryId = args.entryId ?? `gift_ledger_${crypto.randomUUID()}`;
      assertGiftCardId(entryId, "gift-card ledger entry id");
      const businessKey = giftCardRedemptionBusinessKey(args.reservationId);
      assertGiftCardBusinessKey(businessKey);
      const inserted = await database.prepare(`INSERT INTO gift_card_ledger_entries (
        id, gift_card_id, currency_code, entry_type, amount_delta_minor,
        business_key, order_id, reservation_id, related_entry_id, created_at
      ) SELECT ?, reservation.gift_card_id, reservation.currency_code,
        'redemption', -reservation.amount_minor, ?, ?, reservation.id, NULL, ?
      FROM gift_card_reservations reservation
      WHERE reservation.id = ? AND reservation.committed_order_id = ?
        AND reservation.committed_at IS NOT NULL AND reservation.released_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM gift_card_ledger_entries existing
          WHERE existing.reservation_id = reservation.id
        )
      ON CONFLICT DO NOTHING RETURNING id`).bind(
        entryId,
        businessKey,
        args.orderId,
        args.settledAt,
        args.reservationId,
        args.orderId,
      ).first<{ id: string }>();
      const row = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
        .bind(businessKey).first<LedgerRow>();
      if (!row) {
        throw new GiftCardConflictError("Gift-card reservation is not committed for settlement");
      }
      const entry = mapLedger(row);
      const reservation = await findReservationById(args.reservationId);
      if (
        !reservation
        || entry.giftCardId !== reservation.giftCardId
        || entry.entryType !== "redemption"
        || entry.orderId !== args.orderId
        || entry.reservationId !== args.reservationId
        || !entry.amountDelta.equals(reservation.amount.negate())
      ) {
        throw new GiftCardConflictError("Gift-card settlement conflicts with durable state");
      }
      return { created: inserted?.id === entryId, entry };
    },

    async findSettledRedemption(args: {
      reservationId: string;
      orderId: string;
    }): Promise<GiftCardLedgerEntry | undefined> {
      assertGiftCardId(args.reservationId, 'gift-card reservation id');
      assertOrderId(args.orderId);
      const businessKey = giftCardRedemptionBusinessKey(args.reservationId);
      const row = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
        .bind(businessKey).first<LedgerRow>();
      if (!row) return undefined;
      const entry = mapLedger(row);
      if (
        entry.entryType !== 'redemption' || entry.reservationId !== args.reservationId ||
        entry.orderId !== args.orderId || entry.amountDelta.isNegative() === false
      ) throw new GiftCardConflictError('Gift-card redemption conflicts with durable state');
      return entry;
    },

    /** Restore a bounded amount of one settled redemption exactly once per refund key. */
    async restoreRedemption(args: {
      redemptionEntryId: string;
      orderId: string;
      refundKey: string;
      amount: Money;
      restoredAt: number;
      entryId?: string;
    }): Promise<{ created: boolean; entry: GiftCardLedgerEntry }> {
      assertGiftCardId(args.redemptionEntryId, 'gift-card redemption entry id');
      assertOrderId(args.orderId);
      assertGiftCardMoney(args.amount, { positive: true });
      assertGiftCardEpoch(args.restoredAt, 'gift-card restoration time');
      const businessKey = giftCardRestorationBusinessKey(args.redemptionEntryId, args.refundKey);
      const entryId = args.entryId ?? `gift_ledger_${crypto.randomUUID()}`;
      assertGiftCardId(entryId, 'gift-card ledger entry id');
      const existing = async (): Promise<GiftCardLedgerEntry | undefined> => {
        const row = await database.prepare(`${LEDGER_SELECT} WHERE business_key = ? LIMIT 1`)
          .bind(businessKey).first<LedgerRow>();
        return row ? mapLedger(row) : undefined;
      };
      const validate = (entry: GiftCardLedgerEntry): GiftCardLedgerEntry => {
        if (
          entry.entryType !== 'restoration' || entry.orderId !== args.orderId ||
          entry.relatedEntryId !== args.redemptionEntryId || !entry.amountDelta.equals(args.amount)
        ) throw new GiftCardConflictError('Gift-card restoration conflicts with durable state');
        return entry;
      };
      const prior = await existing();
      if (prior) return { created: false, entry: validate(prior) };

      let inserted: { id: string } | null;
      try {
        inserted = await database.prepare(`INSERT INTO gift_card_ledger_entries (
        id, gift_card_id, currency_code, entry_type, amount_delta_minor,
        business_key, order_id, reservation_id, related_entry_id, created_at
      ) SELECT ?, redemption.gift_card_id, redemption.currency_code, 'restoration', ?,
        ?, redemption.order_id, NULL, redemption.id, ?
      FROM gift_card_ledger_entries redemption
      WHERE redemption.id = ? AND redemption.entry_type = 'redemption'
        AND redemption.order_id = ? AND redemption.currency_code = ?
      ON CONFLICT DO NOTHING RETURNING id`).bind(
        entryId,
        args.amount.toMinorUnits(),
        businessKey,
        args.restoredAt,
        args.redemptionEntryId,
        args.orderId,
        args.amount.currency,
      ).first<{ id: string }>();
      } catch {
        const raced = await existing();
        if (raced) return { created: false, entry: validate(raced) };
        throw new GiftCardConflictError('Gift-card redemption cannot be restored');
      }
      const entry = await existing();
      if (!entry) throw new GiftCardConflictError('Gift-card redemption cannot be restored');
      return { created: inserted?.id === entryId, entry: validate(entry) };
    },

    async releaseReservation(args: {
      reservationId: string;
      reason: string;
      releasedAt: number;
    }): Promise<{ released: boolean; reservation: GiftCardReservation }> {
      assertGiftCardId(args.reservationId, "gift-card reservation id");
      assertGiftCardReleaseReason(args.reason);
      assertGiftCardEpoch(args.releasedAt, "gift-card release time");
      const row = await database.prepare(`UPDATE gift_card_reservations
        SET released_at = ?, release_reason = ?
        WHERE id = ? AND committed_at IS NULL AND committed_order_id IS NULL
          AND released_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM gift_card_ledger_entries
            WHERE reservation_id = gift_card_reservations.id
          )
        RETURNING id, gift_card_id, currency_code, request_key,
          quote_fingerprint, requested_amount_minor, amount_minor, reserved_at,
          expires_at, committed_order_id, committed_at, released_at, release_reason`)
        .bind(args.releasedAt, args.reason, args.reservationId).first<ReservationRow>();
      if (row) return { released: true, reservation: mapReservation(row) };
      const existing = await findReservationById(args.reservationId);
      if (existing?.releasedAt !== undefined && existing.releaseReason === args.reason) {
        return { released: false, reservation: existing };
      }
      throw new GiftCardConflictError("Gift-card reservation cannot be released");
    },
  };
}
