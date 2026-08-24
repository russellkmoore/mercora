import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { customers } from "./customer";
import { orders } from "./order";

export type GiftCardAccountStatus = "active" | "disabled";
export type GiftCardLedgerEntryType =
  | "issuance"
  | "redemption"
  | "restoration"
  | "adjustment";
export type GiftCardDeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "needs_review";

const safeInteger = 9_007_199_254_740_991;

export const giftCardAccounts = sqliteTable("gift_card_accounts", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull(),
  codeHashVersion: integer("code_hash_version").notNull(),
  currencyCode: text("currency_code").notNull(),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  issuanceEntryId: text("issuance_entry_id").notNull().unique(),
  issuanceBusinessKey: text("issuance_business_key").notNull().unique(),
  issuedAmountMinor: integer("issued_amount_minor").notNull(),
  issuedOrderId: text("issued_order_id").references(() => orders.id, { onDelete: "restrict" }),
  issuedLineId: text("issued_line_id"),
  purchaserCustomerId: text("purchaser_customer_id")
    .references(() => customers.id, { onDelete: "restrict" }),
  createdAt: integer("created_at").notNull(),
  disabledAt: integer("disabled_at"),
}, (table) => [
  uniqueIndex("gift_card_accounts_code_hash_unique")
    .on(table.codeHashVersion, table.codeHash),
  uniqueIndex("gift_card_accounts_identity_currency_unique")
    .on(table.id, table.currencyCode),
  index("gift_card_accounts_status_idx").on(table.status, table.currencyCode),
  index("gift_card_accounts_order_idx").on(table.issuedOrderId, table.issuedLineId),
  check("gift_card_accounts_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("gift_card_accounts_hash_check", sql`
    length(${table.codeHash}) = 64
    AND ${table.codeHash} = lower(${table.codeHash})
    AND ${table.codeHash} NOT GLOB '*[^0-9a-f]*'
  `),
  check("gift_card_accounts_hash_version_check", sql`
    ${table.codeHashVersion} BETWEEN 1 AND ${safeInteger}
  `),
  check("gift_card_accounts_currency_check", sql`
    length(${table.currencyCode}) = 3
    AND ${table.currencyCode} = upper(${table.currencyCode})
    AND ${table.currencyCode} NOT GLOB '*[^A-Z]*'
  `),
  check("gift_card_accounts_amount_check", sql`
    ${table.issuedAmountMinor} BETWEEN 1 AND ${safeInteger}
  `),
  check("gift_card_accounts_status_check", sql`
    (${table.status} = 'active' AND ${table.disabledAt} IS NULL)
    OR (${table.status} = 'disabled' AND ${table.disabledAt} IS NOT NULL)
  `),
  check("gift_card_accounts_source_check", sql`
    (${table.issuedOrderId} IS NULL AND ${table.issuedLineId} IS NULL)
    OR (${table.issuedOrderId} IS NOT NULL AND ${table.issuedLineId} IS NOT NULL)
  `),
]);

export const giftCardReservations = sqliteTable("gift_card_reservations", {
  id: text("id").primaryKey(),
  giftCardId: text("gift_card_id").notNull(),
  currencyCode: text("currency_code").notNull(),
  requestKey: text("request_key").notNull().unique(),
  quoteFingerprint: text("quote_fingerprint").notNull(),
  requestedAmountMinor: integer("requested_amount_minor").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  reservedAt: integer("reserved_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  committedOrderId: text("committed_order_id")
    .references(() => orders.id, { onDelete: "restrict" }),
  committedAt: integer("committed_at"),
  releasedAt: integer("released_at"),
  releaseReason: text("release_reason"),
}, (table) => [
  foreignKey({
    columns: [table.giftCardId, table.currencyCode],
    foreignColumns: [giftCardAccounts.id, giftCardAccounts.currencyCode],
  }).onDelete("restrict"),
  index("gift_card_reservations_account_idx")
    .on(table.giftCardId, table.releasedAt, table.committedAt, table.expiresAt),
  index("gift_card_reservations_order_idx").on(table.committedOrderId),
  check("gift_card_reservations_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("gift_card_reservations_request_check", sql`
    length(${table.requestKey}) BETWEEN 8 AND 256
  `),
  check("gift_card_reservations_fingerprint_check", sql`
    length(${table.quoteFingerprint}) = 64
    AND ${table.quoteFingerprint} = lower(${table.quoteFingerprint})
    AND ${table.quoteFingerprint} NOT GLOB '*[^0-9a-f]*'
  `),
  check("gift_card_reservations_amount_check", sql`
    ${table.requestedAmountMinor} BETWEEN 1 AND ${safeInteger}
    AND ${table.amountMinor} BETWEEN 1 AND ${table.requestedAmountMinor}
  `),
  check("gift_card_reservations_time_check", sql`
    ${table.reservedAt} BETWEEN 0 AND ${safeInteger}
    AND ${table.expiresAt} BETWEEN 1 AND ${safeInteger}
    AND ${table.expiresAt} > ${table.reservedAt}
  `),
  check("gift_card_reservations_commit_check", sql`
    (${table.committedOrderId} IS NULL AND ${table.committedAt} IS NULL)
    OR (${table.committedOrderId} IS NOT NULL AND ${table.committedAt} IS NOT NULL)
  `),
  check("gift_card_reservations_release_check", sql`
    ((${table.releasedAt} IS NULL AND ${table.releaseReason} IS NULL)
      OR (${table.releasedAt} IS NOT NULL AND ${table.releaseReason} IS NOT NULL))
    AND (${table.committedAt} IS NULL OR ${table.releasedAt} IS NULL)
  `),
]);

export const giftCardLedgerEntries = sqliteTable("gift_card_ledger_entries", {
  id: text("id").primaryKey(),
  giftCardId: text("gift_card_id").notNull(),
  currencyCode: text("currency_code").notNull(),
  entryType: text("entry_type", {
    enum: ["issuance", "redemption", "restoration", "adjustment"],
  }).notNull(),
  amountDeltaMinor: integer("amount_delta_minor").notNull(),
  businessKey: text("business_key").notNull().unique(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
  reservationId: text("reservation_id")
    .references(() => giftCardReservations.id, { onDelete: "restrict" }),
  relatedEntryId: text("related_entry_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.giftCardId, table.currencyCode],
    foreignColumns: [giftCardAccounts.id, giftCardAccounts.currencyCode],
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.relatedEntryId],
    foreignColumns: [table.id],
  }).onDelete("restrict"),
  uniqueIndex("gift_card_ledger_issuance_unique")
    .on(table.giftCardId).where(sql`${table.entryType} = 'issuance'`),
  uniqueIndex("gift_card_ledger_reservation_unique")
    .on(table.reservationId).where(sql`${table.reservationId} IS NOT NULL`),
  index("gift_card_ledger_account_idx").on(table.giftCardId, table.createdAt, table.id),
  index("gift_card_ledger_order_idx").on(table.orderId, table.entryType),
  check("gift_card_ledger_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("gift_card_ledger_amount_check", sql`
    ${table.amountDeltaMinor} BETWEEN -${safeInteger} AND ${safeInteger}
    AND ${table.amountDeltaMinor} <> 0
  `),
  check("gift_card_ledger_business_key_check", sql`
    length(${table.businessKey}) BETWEEN 1 AND 256
  `),
  check("gift_card_ledger_sign_check", sql`
    (${table.entryType} IN ('issuance', 'restoration') AND ${table.amountDeltaMinor} > 0)
    OR (${table.entryType} = 'redemption' AND ${table.amountDeltaMinor} < 0)
    OR ${table.entryType} = 'adjustment'
  `),
  check("gift_card_ledger_reservation_check", sql`
    (${table.entryType} = 'redemption'
      AND ${table.reservationId} IS NOT NULL AND ${table.orderId} IS NOT NULL)
    OR (${table.entryType} <> 'redemption' AND ${table.reservationId} IS NULL)
  `),
  check("gift_card_ledger_restoration_check", sql`
    (${table.entryType} = 'restoration'
      AND ${table.orderId} IS NOT NULL AND ${table.relatedEntryId} IS NOT NULL)
    OR ${table.entryType} <> 'restoration'
  `),
]);

export const giftCardDeliveries = sqliteTable("gift_card_deliveries", {
  id: text("id").primaryKey(),
  giftCardId: text("gift_card_id").notNull().unique()
    .references(() => giftCardAccounts.id, { onDelete: "restrict" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
  orderLineId: text("order_line_id"),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  emailIdempotencyKey: text("email_idempotency_key").notNull().unique(),
  status: text("status", {
    enum: ["pending", "processing", "sent", "needs_review"],
  }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  deliverAfter: integer("deliver_after").notNull().default(0),
  claimToken: text("claim_token"),
  leaseExpiresAt: integer("lease_expires_at"),
  codeCiphertext: text("code_ciphertext"),
  codeNonce: text("code_nonce"),
  codeKeyVersion: integer("code_key_version"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [
  index("gift_card_deliveries_retry_idx")
    .on(table.status, table.deliverAfter, table.leaseExpiresAt, table.updatedAt),
  check("gift_card_deliveries_id_check", sql`length(${table.id}) BETWEEN 1 AND 128`),
  check("gift_card_deliveries_recipient_check", sql`
    length(${table.recipientEmail}) BETWEEN 3 AND 320
    AND (${table.recipientName} IS NULL OR length(${table.recipientName}) BETWEEN 1 AND 200)
  `),
  check("gift_card_deliveries_ciphertext_check", sql`
    (${table.codeCiphertext} IS NULL AND ${table.codeNonce} IS NULL AND ${table.codeKeyVersion} IS NULL)
    OR (${table.codeCiphertext} IS NOT NULL
      AND ${table.codeNonce} IS NOT NULL
      AND ${table.codeKeyVersion} BETWEEN 1 AND ${safeInteger})
  `),
  check("gift_card_deliveries_lease_check", sql`
    (${table.status} = 'processing'
      AND ${table.claimToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)
    OR (${table.status} <> 'processing'
      AND ${table.claimToken} IS NULL AND ${table.leaseExpiresAt} IS NULL)
  `),
  check("gift_card_deliveries_completion_check", sql`
    (${table.status} IN ('sent', 'needs_review') AND ${table.completedAt} IS NOT NULL)
    OR (${table.status} IN ('pending', 'processing') AND ${table.completedAt} IS NULL)
  `),
]);

export type GiftCardAccountRow = typeof giftCardAccounts.$inferSelect;
export type GiftCardReservationRow = typeof giftCardReservations.$inferSelect;
export type GiftCardLedgerEntryRow = typeof giftCardLedgerEntries.$inferSelect;
export type GiftCardDeliveryRow = typeof giftCardDeliveries.$inferSelect;
