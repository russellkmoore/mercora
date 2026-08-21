import { Money } from "@/lib/money";
import {
  assertGiftCardBusinessKey,
  assertGiftCardCodeHash,
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
  type GiftCardAccount,
  type GiftCardCodeHash,
  type GiftCardLedgerEntry,
  type GiftCardReservation,
  type IssueGiftCardInput,
  type ReserveGiftCardInput,
} from "./domain";

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

  return {
    findAccountById,

    async findAccountByCodeHash(codeHash: GiftCardCodeHash): Promise<GiftCardAccount | undefined> {
      assertGiftCardCodeHash(codeHash);
      const row = await database.prepare(
        `${ACCOUNT_SELECT} WHERE code_hash_version = ? AND code_hash = ? LIMIT 1`,
      ).bind(codeHash.keyVersion, codeHash.digest).first<AccountRow>();
      return row ? mapAccount(row) : undefined;
    },

    async issueAccount(input: IssueGiftCardInput): Promise<{
      created: boolean;
      account: GiftCardAccount;
      issuance: GiftCardLedgerEntry;
    }> {
      assertIssueGiftCardInput(input);
      const businessKey = giftCardIssuanceBusinessKey(input.id);
      const result = await database.batch([
        database.prepare(`INSERT INTO gift_card_accounts (
          id, code_hash, code_hash_version, currency_code, status,
          issuance_entry_id, issuance_business_key, issued_amount_minor,
          issued_order_id, issued_line_id, purchaser_customer_id, created_at, disabled_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, NULL)
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
          email_idempotency_key, status, attempt_count, claim_token, lease_expires_at,
          code_ciphertext, code_nonce, code_key_version, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(gift_card_id) DO NOTHING`).bind(
          input.delivery.id,
          input.id,
          input.issuedOrderId ?? null,
          input.issuedLineId ?? null,
          input.delivery.recipientEmail,
          input.delivery.recipientName ?? null,
          input.delivery.emailIdempotencyKey,
          input.delivery.codeCiphertext,
          input.delivery.codeNonce,
          input.delivery.codeKeyVersion,
          input.createdAt,
          input.createdAt,
        )] : []),
      ]);
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
      return { created: (result[0]?.meta.changes ?? 0) === 1, account, issuance };
    },

    async readBalance(giftCardId: string, now: number): Promise<GiftCardBalance | undefined> {
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
    },

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
