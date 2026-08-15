import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "migrations", "0022_add_gift_cards.sql"),
  "utf8",
);
const statements = sql.replace(/^\s*--.*$/gm, "");

describe("gift-card foundation migration", () => {
  it("is additive, default-empty, and leaves core order/webhook state intact", () => {
    expect(sql).toContain("CREATE TABLE gift_card_accounts");
    expect(sql).toContain("CREATE TABLE gift_card_reservations");
    expect(sql).toContain("CREATE TABLE gift_card_ledger_entries");
    expect(sql).toContain("CREATE TABLE gift_card_deliveries");
    expect(statements).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|ALTER)\b/im);
    expect(sql).not.toMatch(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:orders|processed_webhook_events)/i);
  });

  it("stores only the versioned digest lookup and AEAD delivery placeholders", () => {
    expect(sql).toContain("code_hash TEXT NOT NULL CHECK");
    expect(sql).toContain("UNIQUE (code_hash_version, code_hash)");
    expect(sql).toContain("code_ciphertext TEXT CHECK");
    expect(sql).toContain("code_nonce TEXT CHECK");
    expect(sql).toContain("code_key_version INTEGER CHECK");
    expect(sql).not.toMatch(/(?:raw|plain)(?:text)?_?code/i);
  });

  it("derives balance from signed ledger entries and guards every raw writer", () => {
    expect(sql).toContain("amount_delta_minor INTEGER NOT NULL");
    expect(sql).toContain("gift_card_ledger_balance_guard");
    expect(sql).toContain("gift_card_ledger_issuance_guard");
    expect(sql).toContain("gift_card_ledger_redemption_guard");
    expect(sql).toContain("gift_card_ledger_restoration_guard");
    expect(sql).toContain("gift_card_ledger_append_only_update");
    expect(sql).toContain("gift_card_ledger_append_only_delete");
    expect(sql).toContain("gift_card_reservations_balance_guard");
    expect(sql).toContain("SUM(entry.amount_delta_minor)");
    expect(sql).not.toMatch(/\bbalance_minor\b/);
    expect(sql).toContain("9007199254740991");
  });

  it("freezes financial identity while permitting guarded terminal transitions", () => {
    expect(sql).toContain("gift_card_accounts_identity_immutable");
    expect(sql).toContain("gift_card_accounts_status_transition_guard");
    expect(sql).toContain("gift_card_reservations_identity_immutable");
    expect(sql).toContain("gift_card_reservations_transition_guard");
    expect(sql).toContain("NEW.committed_at >= OLD.reserved_at");
    expect(sql).toContain("NEW.released_at >= OLD.reserved_at");
  });

  it("binds bounded restorations to the original redemption and order", () => {
    expect(sql).toContain("redemption.id = NEW.related_entry_id");
    expect(sql).toContain("redemption.gift_card_id = NEW.gift_card_id");
    expect(sql).toContain("redemption.currency_code = NEW.currency_code");
    expect(sql).toContain("redemption.order_id = NEW.order_id");
    expect(sql).toContain("SUM(restoration.amount_delta_minor)");
  });

  it("makes issuance, reservation requests, redemption, and delivery deterministic", () => {
    expect(sql).toContain("issuance_business_key TEXT NOT NULL UNIQUE");
    expect(sql).toContain("request_key TEXT NOT NULL UNIQUE");
    expect(sql).toContain("business_key TEXT NOT NULL UNIQUE");
    expect(sql).toContain("gift_card_ledger_reservation_unique");
    expect(sql).toContain("email_idempotency_key TEXT NOT NULL UNIQUE");
  });
});
