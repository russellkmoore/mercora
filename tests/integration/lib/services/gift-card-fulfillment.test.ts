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

import { drainGiftCardDeliveries, fulfillPaidGiftCards } from '@/lib/services/gift-card-fulfillment';
import type { Order } from '@/lib/types/order';

const now = 1_800_000_000;
const deliveryKey = 'base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
const hmacKey = 'gift-card-hmac-key-material-for-worker-tests-0001';
let sequence = 0;

function giftOrder(): Order {
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
      },
    }],
  };
}

function runtimeEnvironment(): Record<string, unknown> & { DB: D1Database } {
  return {
    DB: env.DB,
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
    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 }))
      .resolves.toEqual({ attempted: 1 });

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
    mocks.send.mockResolvedValue({ success: false, error: 'permanent bounce' });

    // Attempt 1 happens in the paid effect; drain until the budget is exhausted.
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    for (let attempt = 1; attempt <= 7; attempt += 1) {
      await drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + attempt });
    }

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

  it('moves corrupted retry material to review without rendering or sending a bearer code', async () => {
    const order = giftOrder();
    await insertOrder(order);
    mocks.send.mockResolvedValueOnce({ success: false, error: 'temporary provider failure' });
    await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
    await env.DB.prepare(`UPDATE gift_card_deliveries SET code_ciphertext = NULL,
      code_nonce = NULL, code_key_version = NULL
      WHERE order_id = ?`).bind(order.id).run();

    await expect(drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 }))
      .resolves.toEqual({ attempted: 1 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await expect(env.DB.prepare(`SELECT status, completed_at FROM gift_card_deliveries WHERE order_id = ?`)
      .bind(order.id).first()).resolves.toMatchObject({ status: 'needs_review', completed_at: now + 1 });
  });
});
