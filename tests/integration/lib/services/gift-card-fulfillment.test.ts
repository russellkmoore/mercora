import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyTestMigrations } from '../../helpers/d1';
import { Money } from '@/lib/money';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.send }));
vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: 'Test Store' },
    contact: { senderEmail: 'Test Store <orders@example.test>' },
  }),
}));

import {
  drainGiftCardDeliveries,
  fulfillPaidGiftCards,
  issueAdminGiftCard,
  resendGiftCardDelivery,
} from '@/lib/services/gift-card-fulfillment';
import { TELEMETRY_MARKER } from '@/lib/observability/telemetry';
import { TAIL_CRITICAL_EVENTS } from '@/workers/observability-tail/src/core';
import type { Order } from '@/lib/types/order';

const now = 1_800_000_000;
const deliveryKey = 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const hmacKey = 'gift-card-hmac-key-material-for-worker-tests-0001';
let sequence = 0;

function giftOrder(giftMessage?: string): Order {
  sequence += 1;
  const id = `gift-fulfillment-order-${sequence}`;
  return {
    id,
    status: 'processing',
    payment_status: 'paid',
    payment_method: 'gift_card',
    total_amount: Money.fromMinor(2_500, 'USD').toJSON(),
    currency_code: 'USD',
    items: [{
      id: `gift-fulfillment-line-${sequence}`,
      product_id: 'gift-product',
      sku: 'GIFT-25',
      product_name: 'Gift card',
      quantity: 1,
      unit_price: Money.fromMinor(2_500, 'USD').toJSON(),
      total_price: Money.fromMinor(2_500, 'USD').toJSON(),
      fulfillment_type: 'digital',
      gift_card: {
        recipientEmail: `recipient-${sequence}@example.test`,
        recipientName: 'Recipient',
        ...(giftMessage === undefined ? {} : { message: giftMessage }),
      },
    }],
  };
}

function runtimeEnvironment(): Record<string, unknown> & { DB: D1Database } {
  return {
    DB: env.DB,
    EMAIL: { send: vi.fn() },
    EMAIL_PROVIDER: 'cloudflare',
    GIFT_CARD_CODE_HMAC_CURRENT_VERSION: '1',
    GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: hmacKey }),
    GIFT_CARD_DELIVERY_CURRENT_VERSION: '1',
    GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: deliveryKey }),
  };
}

async function insertOrder(order: Order): Promise<void> {
  await env.DB.prepare(`INSERT INTO orders
    (id, customer_id, status, total_amount, currency_code, items, payment_status, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      order.id,
      order.status,
      JSON.stringify(order.total_amount),
      order.currency_code,
      JSON.stringify(order.items),
      order.payment_status,
      new Date(now * 1_000).toISOString(),
      new Date(now * 1_000).toISOString(),
    ).run();
}

/** Issue and immediately deliver one gift-card order, for resend tests that need a `sent` row. */
async function issueAndDeliver(): Promise<{ order: Order; deliveryId: string; giftCardId: string }> {
  const order = giftOrder();
  await insertOrder(order);
  mocks.send.mockResolvedValueOnce({ success: true, id: 'setup-send' });
  await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
  const row = await env.DB.prepare(`SELECT id AS delivery_id, gift_card_id
    FROM gift_card_deliveries WHERE order_id = ?`).bind(order.id)
    .first<{ delivery_id: string; gift_card_id: string }>();
  if (!row) throw new Error('setup: delivery row missing after fulfillPaidGiftCards');
  return { order, deliveryId: row.delivery_id, giftCardId: row.gift_card_id };
}

beforeAll(async () => {
  await applyTestMigrations();
});

beforeEach(() => {
  mocks.send.mockReset();
});

describe('gift-card issuance and durable delivery on real D1', () => {
  it('issues once, retries delivery, and never persists the bearer code', async () => {
    const order = giftOrder();
    await insertOrder(order);
    let deliveredCode = '';
    mocks.send.mockImplementationOnce(async (message: { text: string }) => {
      deliveredCode = message.text.match(/Code: ([A-Z0-9-]+)/)?.[1] ?? '';
      return { success: false, error: 'temporary provider failure' };
    });

    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });

    expect(deliveredCode).toMatch(/^GC-(?:[A-Z0-9]{4}-){6}[A-Z0-9]{4}$/);
    const initial = await env.DB.prepare(`SELECT status, attempt_count, code_ciphertext,
      code_nonce, code_key_version FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first<{
        status: string;
        attempt_count: number;
        code_ciphertext: string | null;
        code_nonce: string | null;
        code_key_version: number | null;
      }>();
    expect(initial).toMatchObject({
      status: 'pending', attempt_count: 1, code_key_version: 1,
    });
    expect(initial?.code_ciphertext).toBeTruthy();
    expect(initial?.code_ciphertext).not.toContain(deliveredCode);
    expect(initial?.code_nonce).toBeTruthy();

    mocks.send.mockResolvedValueOnce({ success: true, id: 'provider-message-1' });
    const emailBinding = { send: vi.fn() };
    await expect(drainGiftCardDeliveries({
      environment: { ...runtimeEnvironment(), EMAIL: emailBinding, EMAIL_PROVIDER: 'cloudflare' },
      now: now + 1,
    })).resolves.toEqual({ attempted: 1 });

    // The drain runs from the cron handler, where the sender has no request
    // context to read bindings from: the worker env must be handed over.
    const sendOptions = mocks.send.mock.calls.at(-1)?.[1] as {
      idempotencyKey: string; env: Record<string, unknown>;
    };
    expect(sendOptions).toMatchObject({
      idempotencyKey: expect.stringMatching(/^gift-card-delivery\//),
      env: { EMAIL: emailBinding, DB: env.DB, EMAIL_PROVIDER: 'cloudflare' },
    });
    // toMatchObject matches the nested env partially, so name the whole key set:
    // a Resend key must never ride along on the Cloudflare path.
    expect(Object.keys(sendOptions.env).sort()).toEqual(['DB', 'EMAIL', 'EMAIL_PROVIDER']);

    const persisted = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM gift_card_accounts WHERE issued_order_id = ?) AS accounts,
      (SELECT COUNT(*) FROM gift_card_ledger_entries WHERE order_id = ? AND entry_type = 'issuance') AS issuances,
      (SELECT status FROM gift_card_deliveries WHERE order_id = ?) AS delivery_status`)
      .bind(order.id, order.id, order.id).first<{
        accounts: number;
        issuances: number;
        delivery_status: string;
      }>();
    expect(persisted).toEqual({ accounts: 1, issuances: 1, delivery_status: 'sent' });

    // Repeat the paid effect. It must neither issue a second value nor send a
    // second email after the durable delivery is terminal.
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now: now + 2 });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    await expect(env.DB.prepare(`SELECT COUNT(*) AS count FROM gift_card_accounts WHERE issued_order_id = ?`)
      .bind(order.id).first<{ count: number }>()).resolves.toEqual({ count: 1 });

    const durableState = await env.DB.prepare(`SELECT
      (SELECT group_concat(code_hash, '|') FROM gift_card_accounts WHERE issued_order_id = ?) AS hashes,
      (SELECT group_concat(code_ciphertext, '|') FROM gift_card_deliveries WHERE order_id = ?) AS ciphertexts,
      (SELECT group_concat(items, '|') FROM orders WHERE id = ?) AS order_items`)
      .bind(order.id, order.id, order.id).first();
    expect(JSON.stringify(durableState)).not.toContain(deliveredCode);
  });

  it('holds a scheduled card until its delivery date, then sends', async () => {
    const order = giftOrder();
    order.items[0].gift_card!.deliveryDate = '2030-01-01';
    const due = Math.floor(Date.UTC(2030, 0, 1) / 1_000);
    await insertOrder(order);

    // Paid effect issues the card but must not email the recipient before the date.
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    expect(mocks.send).not.toHaveBeenCalled();
    const scheduled = await env.DB.prepare(`SELECT status, attempt_count, deliver_after
      FROM gift_card_deliveries WHERE order_id = ?`).bind(order.id)
      .first<{ status: string; attempt_count: number; deliver_after: number }>();
    expect(scheduled).toEqual({ status: 'pending', attempt_count: 0, deliver_after: due });

    // A drain before the date claims nothing.
    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 }))
      .resolves.toEqual({ attempted: 0 });
    expect(mocks.send).not.toHaveBeenCalled();

    // Once due, the drain delivers.
    mocks.send.mockResolvedValueOnce({ success: true, id: 'provider-scheduled' });
    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: due }))
      .resolves.toEqual({ attempted: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await expect(env.DB.prepare(`SELECT status FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first()).resolves.toMatchObject({ status: 'sent' });
  });

  it('escalates a permanently failing delivery to review after the attempt budget', async () => {
    const order = giftOrder();
    await insertOrder(order);
    // A provider-configuration failure reports no provider at all (the sender
    // never picked one); the envelope must still name email, not the database.
    mocks.send.mockResolvedValue({
      success: false, error: 'permanent bounce', errorCode: 'E_PROVIDER_CONFIG',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Attempt 1 happens in the paid effect; drain until the budget is exhausted.
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      await drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + attempt });
    }

    // Every attempt emits a telemetry envelope the tail consumer can see:
    // the marker, a registered critical event, and closed-enum fields only.
    const logged = errorSpy.mock.calls.map((call) => JSON.parse(String(call[0])));
    expect(logged).toHaveLength(8);
    expect(logged[0]).toEqual({
      marker: TELEMETRY_MARKER,
      event: 'gift_card.delivery_failed',
      area: 'gift_card',
      severity: 'critical',
      timestamp: expect.any(String),
      fields: {
        operation: 'send',
        outcome: 'failed',
        provider: 'cloudflare_email',
        // Attempt 1 is the immediate post-payment send, not the recovery drain.
        trigger: 'request',
        retryable: true,
        attempt: 1,
      },
    });
    // The last attempt is the one that parks the row for a human.
    expect(logged.at(-1)?.fields).toMatchObject({ attempt: 8, retryable: false, trigger: 'recovery' });
    // The tail worker only alerts on events in its critical list.
    expect(TAIL_CRITICAL_EVENTS).toContain('gift_card.delivery_failed');
    // Nothing free-text survives sanitizeTelemetryFields, so the provider's own
    // message ('permanent bounce') must not appear anywhere in the envelope.
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain('permanent bounce');
    expect(serialized).not.toContain(order.items[0].gift_card!.recipientEmail);
    expect(serialized).not.toMatch(/GC-[A-Z0-9]{4}/);
    errorSpy.mockRestore();

    const parked = await env.DB.prepare(`SELECT status, attempt_count, completed_at
      FROM gift_card_deliveries WHERE order_id = ?`).bind(order.id)
      .first<{ status: string; attempt_count: number; completed_at: number }>();
    expect(parked).toEqual({ status: 'needs_review', attempt_count: 8, completed_at: now + 7 });

    // A terminal review row is no longer reclaimed.
    const sends = mocks.send.mock.calls.length;
    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 8 }))
      .resolves.toEqual({ attempted: 0 });
    expect(mocks.send).toHaveBeenCalledTimes(sends);
  });

  it("carries the buyer's gift message into the delivery email, HTML-escaped", async () => {
    const order = giftOrder('Happy birthday!\n<script>alert(1)</script>');
    await insertOrder(order);
    mocks.send.mockResolvedValueOnce({ success: true, id: 'provider-message-note' });

    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });

    const sent = mocks.send.mock.calls.at(-1)?.[0] as { text: string; html: string };
    expect(sent.text).toContain('Happy birthday!');
    expect(sent.text).toContain('<script>alert(1)</script>');
    expect(sent.html).toContain('Happy birthday!');
    // The note is shopper-controlled text: it must reach the HTML escaped.
    expect(sent.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(sent.html).not.toContain('<script>');
    expect(sent.html).toContain('<blockquote>');

    // WR-08: the note is the only part of this email the store did not write.
    // It must be attributed, and it must sit below the code block so nothing
    // buyer-authored is ever framed as instructions about the code.
    expect(sent.text).toContain('Message from the sender:');
    expect(sent.html).toContain('<p>Message from the sender:</p>');
    expect(sent.text.indexOf('Message from the sender:'))
      .toBeGreaterThan(sent.text.indexOf('Keep this code private.'));
    expect(sent.html.indexOf('<blockquote>'))
      .toBeGreaterThan(sent.html.indexOf('Keep this code private.'));
  });

  it('sends without a quote block when the buyer left no gift message', async () => {
    const order = giftOrder();
    await insertOrder(order);
    mocks.send.mockResolvedValueOnce({ success: true, id: 'provider-message-none' });

    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });

    const sent = mocks.send.mock.calls.at(-1)?.[0] as { text: string; html: string };
    expect(sent.html).not.toContain('<blockquote>');
    expect(sent.text).not.toMatch(/""/);
    expect(sent.text).toContain('Code: ');
  });

  it('moves corrupted retry material to review without rendering or sending a bearer code', async () => {
    const order = giftOrder();
    await insertOrder(order);
    mocks.send.mockResolvedValueOnce({ success: false, error: 'temporary provider failure' });
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await env.DB.prepare(`UPDATE gift_card_deliveries SET code_ciphertext = NULL,
      code_nonce = NULL, code_key_version = NULL
      WHERE order_id = ?`).bind(order.id).run();

    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 }))
      .resolves.toEqual({ attempted: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await expect(env.DB.prepare(`SELECT status, completed_at FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first()).resolves.toMatchObject({ status: 'needs_review', completed_at: now + 1 });

    // WR-10: terminal on the first attempt, so it never reaches the retry
    // budget that would otherwise surface it. A paid card that can never be
    // delivered has to page someone.
    const parked = errorSpy.mock.calls
      .map((call) => JSON.parse(String(call[0])))
      .filter((entry) => entry.event === 'gift_card.delivery_failed');
    expect(parked).toHaveLength(1);
    expect(parked[0]).toMatchObject({
      severity: 'critical',
      fields: { outcome: 'failed', provider: 'd1', retryable: false },
    });
    errorSpy.mockRestore();
  });

  // IN-06: the fail-soft branch the CR-02 fix relies on -- every other test in
  // this file reads a well-formed snapshot, so none of them exercised it. The
  // order row itself cannot be deleted (gift_card_deliveries.order_id and
  // gift_card_accounts.issued_order_id are both ON DELETE RESTRICT), so this
  // corrupts the snapshot instead, which is the same catch.
  it('still delivers the card when the order snapshot cannot be read', async () => {
    const order = giftOrder('Happy birthday!');
    await insertOrder(order);
    mocks.send.mockResolvedValueOnce({ success: false, error: 'temporary provider failure' });
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    await env.DB.prepare('UPDATE orders SET items = ? WHERE id = ?')
      .bind('{ not json', order.id).run();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.send.mockResolvedValueOnce({ success: true, id: 'no-snapshot' });
    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 }))
      .resolves.toEqual({ attempted: 1 });

    // The card still goes out -- a card without its note beats no card.
    const sent = mocks.send.mock.calls.at(-1)?.[0] as { text: string; html: string };
    expect(sent.text).toContain('Code: ');
    expect(sent.text).not.toContain('Message from the sender:');
    expect(sent.html).not.toContain('<blockquote>');
    await expect(env.DB.prepare(`SELECT status FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first()).resolves.toMatchObject({ status: 'sent' });

    // IN-05: fail soft, but not in silence -- the article states as fact that
    // the note is included, so a snapshot that stops being readable has to say so.
    // The card was delivered, so this is a warning, never the critical paging event.
    const paged = errorSpy.mock.calls
      .map((call) => JSON.parse(String(call[0])))
      .filter((entry) => entry.event === 'gift_card.delivery_failed');
    expect(paged).toHaveLength(0);
    const dropped = warnSpy.mock.calls
      .map((call) => JSON.parse(String(call[0])))
      .filter((entry) => entry.event === 'gift_card.delivery_note_dropped');
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatchObject({
      severity: 'warning',
      fields: { outcome: 'degraded', provider: 'd1', retryable: false },
      error_class: 'SyntaxError',
    });
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('admin-created gift card (D-07, D-19)', () => {
  const adminMaxMinor = 20_000;

  it('creates an account with no order, line, or purchaser attribution, and a four-character code suffix', async () => {
    const result = await issueAdminGiftCard({
      requestId: 'admin-request-attribution-1',
      amount: Money.fromMinor(5_000, 'USD'),
      recipientEmail: 'admin-recipient-1@example.test',
      recipientName: 'Admin Recipient',
      environment: runtimeEnvironment(),
      now,
    });
    expect(result.created).toBe(true);
    const row = await env.DB.prepare(`SELECT issued_order_id, issued_line_id,
      purchaser_customer_id, code_suffix, issued_amount_minor
      FROM gift_card_accounts WHERE id = ?`).bind(result.giftCardId).first<{
        issued_order_id: string | null;
        issued_line_id: string | null;
        purchaser_customer_id: string | null;
        code_suffix: string | null;
        issued_amount_minor: number;
      }>();
    expect(row).toMatchObject({
      issued_order_id: null,
      issued_line_id: null,
      purchaser_customer_id: null,
      issued_amount_minor: 5_000,
    });
    expect(row?.code_suffix).toMatch(/^[23456789A-HJ-NP-Z]{4}$/);
  });

  it('converges two calls with the same requestId into one account', async () => {
    const args = {
      requestId: 'admin-request-idempotent-1',
      amount: Money.fromMinor(2_500, 'USD'),
      recipientEmail: 'admin-recipient-2@example.test',
      environment: runtimeEnvironment(),
      now,
    };
    const first = await issueAdminGiftCard(args);
    const second = await issueAdminGiftCard(args);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.giftCardId).toBe(first.giftCardId);
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM gift_card_accounts WHERE id = ?`)
      .bind(first.giftCardId).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it('creates two separate accounts for two different requestIds', async () => {
    const base = {
      amount: Money.fromMinor(2_500, 'USD'),
      recipientEmail: 'admin-recipient-3@example.test',
      environment: runtimeEnvironment(),
      now,
    };
    const first = await issueAdminGiftCard({ ...base, requestId: 'admin-request-distinct-a' });
    const second = await issueAdminGiftCard({ ...base, requestId: 'admin-request-distinct-b' });
    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.giftCardId).not.toBe(second.giftCardId);
  });

  it('refuses an amount at or below zero, or above the configured maximum, and writes nothing', async () => {
    const before = await env.DB.prepare(`SELECT COUNT(*) AS count FROM gift_card_accounts`)
      .first<{ count: number }>();
    const invalidAmounts = [
      Money.fromMinor(0, 'USD'),
      Money.fromMinor(-100, 'USD'),
      Money.fromMinor(adminMaxMinor + 1, 'USD'),
    ];
    for (const [index, amount] of invalidAmounts.entries()) {
      await expect(issueAdminGiftCard({
        requestId: `admin-request-invalid-${index}`,
        amount,
        recipientEmail: 'admin-recipient-invalid@example.test',
        environment: runtimeEnvironment(),
        now,
      })).rejects.toThrow();
    }
    const after = await env.DB.prepare(`SELECT COUNT(*) AS count FROM gift_card_accounts`)
      .first<{ count: number }>();
    expect(after?.count).toBe(before?.count);
  });

  it('delivers an admin-created card through the existing cron drain', async () => {
    const created = await issueAdminGiftCard({
      requestId: 'admin-request-drain-1',
      amount: Money.fromMinor(10_000, 'USD'),
      recipientEmail: 'admin-recipient-drain@example.test',
      environment: runtimeEnvironment(),
      now,
    });
    mocks.send.mockResolvedValue({ success: true, id: 'admin-drain-1' });
    const before = mocks.send.mock.calls.length;
    await drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 });
    const calls = mocks.send.mock.calls.slice(before) as Array<[{ to: string }, unknown]>;
    const matched = calls.find(([message]) => message.to === 'admin-recipient-drain@example.test');
    expect(matched).toBeTruthy();
    const delivery = await env.DB.prepare(`SELECT status FROM gift_card_deliveries WHERE gift_card_id = ?`)
      .bind(created.giftCardId).first<{ status: string }>();
    expect(delivery?.status).toBe('sent');
  });
});

interface DeliverySnapshot {
  status: string;
  attempt_count: number;
  completed_at: number | null;
  claim_token: string | null;
  lease_expires_at: number | null;
}

async function deliverySnapshot(deliveryId: string): Promise<DeliverySnapshot | null> {
  return env.DB.prepare(`SELECT status, attempt_count, completed_at, claim_token, lease_expires_at
    FROM gift_card_deliveries WHERE id = ?`).bind(deliveryId).first<DeliverySnapshot>();
}

describe('gift-card delivery resend (D-08, D-21)', () => {
  it('resends a sent delivery to the original recipient with the caller-supplied idempotency key, leaving the delivery row unchanged', async () => {
    const { order, deliveryId } = await issueAndDeliver();
    const before = await deliverySnapshot(deliveryId);
    const rowBefore = await env.DB.prepare(`SELECT email_idempotency_key FROM gift_card_deliveries WHERE id = ?`)
      .bind(deliveryId).first<{ email_idempotency_key: string }>();

    mocks.send.mockResolvedValueOnce({ success: true, id: 'resend-1' });
    const key = `gift-card-resend/${deliveryId}/evt-1`;
    const result = await resendGiftCardDelivery({
      deliveryId, idempotencyKey: key, environment: runtimeEnvironment(), now: now + 100,
    });
    expect(result).toEqual({ sent: true });

    const [message, options] = mocks.send.mock.calls.at(-1) as [
      { to: string; text: string }, { idempotencyKey: string },
    ];
    expect(message.to).toBe(order.items[0].gift_card!.recipientEmail);
    expect(message.text).toContain('Code: ');
    expect(options.idempotencyKey).toBe(key);
    expect(options.idempotencyKey).not.toBe(rowBefore?.email_idempotency_key);

    const after = await deliverySnapshot(deliveryId);
    expect(after).toEqual(before);
  });

  it('resends a needs_review delivery', async () => {
    const { deliveryId } = await issueAndDeliver();
    await env.DB.prepare(`UPDATE gift_card_deliveries SET status = 'needs_review' WHERE id = ?`)
      .bind(deliveryId).run();

    mocks.send.mockResolvedValueOnce({ success: true, id: 'resend-2' });
    const result = await resendGiftCardDelivery({
      deliveryId, idempotencyKey: `gift-card-resend/${deliveryId}/evt-2`,
      environment: runtimeEnvironment(), now: now + 100,
    });
    expect(result).toEqual({ sent: true });
    expect(mocks.send).toHaveBeenCalledTimes(2); // setup send + this resend
  });

  it('refuses a pending delivery without sending', async () => {
    const order = giftOrder();
    order.items[0].gift_card!.deliveryDate = '2031-01-01';
    await insertOrder(order);
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    const row = await env.DB.prepare(`SELECT id FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first<{ id: string }>();

    const before = mocks.send.mock.calls.length;
    const result = await resendGiftCardDelivery({
      deliveryId: row!.id, idempotencyKey: `gift-card-resend/${row!.id}/evt-3`,
      environment: runtimeEnvironment(), now: now + 1,
    });
    expect(result).toEqual({ sent: false, reason: 'not_resendable' });
    expect(mocks.send.mock.calls.length).toBe(before);
  });

  it('sends to an admin-supplied address instead of the original recipient when `to` is provided', async () => {
    const { deliveryId } = await issueAndDeliver();
    mocks.send.mockResolvedValueOnce({ success: true, id: 'resend-4' });
    const result = await resendGiftCardDelivery({
      deliveryId, to: 'fraud-recovery@example.test',
      idempotencyKey: `gift-card-resend/${deliveryId}/evt-4`,
      environment: runtimeEnvironment(), now: now + 100,
    });
    expect(result).toEqual({ sent: true });
    const [message] = mocks.send.mock.calls.at(-1) as [{ to: string }];
    expect(message.to).toBe('fraud-recovery@example.test');
  });

  it('refuses a delivery whose ciphertext is absent', async () => {
    const { deliveryId } = await issueAndDeliver();
    await env.DB.prepare(`UPDATE gift_card_deliveries SET code_ciphertext = NULL,
      code_nonce = NULL, code_key_version = NULL WHERE id = ?`).bind(deliveryId).run();

    const before = mocks.send.mock.calls.length;
    const result = await resendGiftCardDelivery({
      deliveryId, idempotencyKey: `gift-card-resend/${deliveryId}/evt-5`,
      environment: runtimeEnvironment(), now: now + 100,
    });
    expect(result).toEqual({ sent: false, reason: 'code_unavailable' });
    expect(mocks.send.mock.calls.length).toBe(before);
  });

  it('reports a sender failure to the caller and leaves the delivery row untouched', async () => {
    const { deliveryId } = await issueAndDeliver();
    const before = await deliverySnapshot(deliveryId);

    mocks.send.mockResolvedValueOnce({ success: false, error: 'temporary provider failure' });
    const result = await resendGiftCardDelivery({
      deliveryId, idempotencyKey: `gift-card-resend/${deliveryId}/evt-6`,
      environment: runtimeEnvironment(), now: now + 100,
    });
    expect(result).toEqual({ sent: false, reason: 'send_failed' });

    const after = await deliverySnapshot(deliveryId);
    expect(after).toEqual(before);
  });
});
