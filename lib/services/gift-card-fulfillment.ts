import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Money } from '@/lib/money';
import { createGiftCardRepository } from '@/lib/gift-cards/repository';
import { digestGiftCardCode, generateGiftCardCode, type GiftCardKeyRing } from '@/lib/gift-cards/code';
import {
  decryptGiftCardDeliveryCode,
  encryptGiftCardDeliveryCode,
  type GiftCardEncryptionKeyRing,
} from '@/lib/gift-cards/encryption';
import { parseGiftCardCodeKeyRing, parseGiftCardDeliveryKeyRing } from '@/lib/gift-cards/config';
import { isGiftCardOrderLine } from '@/lib/gift-cards/checkout';
import { sendEmail } from '@/lib/email/sender';
import { getStoreConfig } from '@/lib/store-config';
import type { Order } from '@/lib/types/order';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';

const DELIVERY_LEASE_SECONDS = 10 * 60;

interface GiftCardFulfillmentEnvironment extends Record<string, unknown> { DB?: D1Database }

function epochSeconds(): number { return Math.floor(Date.now() / 1_000); }

async function stableId(prefix: string, orderId: string, lineId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${prefix}\u0000v1\u0000${orderId}\u0000${lineId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `${prefix}_${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function deliveryMessage(args: { code: string; amount: Money; recipientName?: string }) {
  const store = getStoreConfig();
  const greeting = args.recipientName ? `Hello ${args.recipientName},` : 'Hello,';
  const subject = `${store.identity.name} gift card`;
  return {
    from: store.contact.senderEmail,
    to: '',
    subject,
    text: `${greeting}\n\nYou received a ${args.amount.format()} gift card.\n\nCode: ${args.code}\n\nKeep this code private.`,
    html: `<p>${escapeHtmlText(greeting)}</p><p>You received a ${escapeHtmlText(args.amount.format())} gift card.</p><p><strong>${escapeHtmlText(args.code)}</strong></p><p>Keep this code private.</p>`,
  };
}

async function issueLine(args: {
  repository: ReturnType<typeof createGiftCardRepository>;
  order: Order;
  line: Order['items'][number];
  hmac: GiftCardKeyRing;
  deliveryKeys: GiftCardEncryptionKeyRing;
  now: number;
}): Promise<string> {
  const recipient = args.line.gift_card;
  if (!args.order.id || !args.line.id || !recipient) throw new Error('Gift-card order snapshot is invalid');
  const giftCardId = await stableId('gift_card', args.order.id, args.line.id);
  const existing = await args.repository.findAccountById(giftCardId);
  if (existing) return giftCardId;
  const deliveryId = await stableId('gift_delivery', args.order.id, args.line.id);
  const code = generateGiftCardCode();
  try {
    const codeHash = await digestGiftCardCode(code, args.hmac);
    if (!codeHash) throw new Error('Generated gift-card code is invalid');
    const encrypted = await encryptGiftCardDeliveryCode({
      giftCardId, deliveryId, code, keyRing: args.deliveryKeys,
    });
    await args.repository.issueAccount({
      id: giftCardId,
      codeHash,
      amount: Money.fromStored(args.line.unit_price, args.order.currency_code),
      issuedOrderId: args.order.id,
      issuedLineId: args.line.id,
      purchaserCustomerId: args.order.customer_id,
      createdAt: args.now,
      delivery: {
        id: deliveryId,
        recipientEmail: recipient.recipientEmail,
        ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
        emailIdempotencyKey: `gift-card-delivery/${giftCardId}/v1`,
        codeCiphertext: encrypted.ciphertext,
        codeNonce: encrypted.nonce,
        codeKeyVersion: encrypted.keyVersion,
      },
    });
  } finally {
    // Strings cannot be reliably zeroized in JS; keep this scope minimal and
    // never return, store, log, or attach the bearer code to an error.
  }
  return giftCardId;
}

async function deliverOne(args: {
  database: D1Database;
  giftCardId: string;
  keys: GiftCardEncryptionKeyRing;
  now: number;
}): Promise<void> {
  const token = crypto.randomUUID();
  const claimed = await args.database.prepare(`UPDATE gift_card_deliveries
    SET status = 'processing', attempt_count = attempt_count + 1, claim_token = ?,
        lease_expires_at = ?, updated_at = ?
    WHERE gift_card_id = ? AND (status = 'pending' OR (status = 'processing' AND lease_expires_at <= ?))
    RETURNING id, recipient_email, recipient_name, email_idempotency_key, code_ciphertext,
      code_nonce, code_key_version`).bind(
    token, args.now + DELIVERY_LEASE_SECONDS, args.now, args.giftCardId, args.now,
  ).first<{
    id: string; recipient_email: string; recipient_name: string | null; email_idempotency_key: string;
    code_ciphertext: string | null; code_nonce: string | null; code_key_version: number | null;
  }>();
  if (!claimed) return;
  if (!claimed.code_ciphertext || !claimed.code_nonce || !claimed.code_key_version) {
    await args.database.prepare(`UPDATE gift_card_deliveries SET status = 'needs_review',
      claim_token = NULL, lease_expires_at = NULL, completed_at = ?, updated_at = ?
      WHERE id = ? AND claim_token = ?`).bind(args.now, args.now, claimed.id, token).run();
    return;
  }
  let code: string | undefined;
  try {
    code = await decryptGiftCardDeliveryCode({
      giftCardId: args.giftCardId,
      deliveryId: claimed.id,
      encrypted: { keyVersion: claimed.code_key_version, nonce: claimed.code_nonce, ciphertext: claimed.code_ciphertext },
      keyRing: args.keys,
    });
    const account = await args.database.prepare(`SELECT issued_amount_minor, currency_code FROM gift_card_accounts WHERE id = ?`)
      .bind(args.giftCardId).first<{ issued_amount_minor: number; currency_code: string }>();
    if (!account) throw new Error('Gift-card account is missing');
    const message = deliveryMessage({
      code, amount: Money.fromMinor(account.issued_amount_minor, account.currency_code),
      ...(claimed.recipient_name ? { recipientName: claimed.recipient_name } : {}),
    });
    const result = await sendEmail({ ...message, to: claimed.recipient_email }, { idempotencyKey: claimed.email_idempotency_key });
    const status = result.success ? 'sent' : result.needsReview ? 'needs_review' : 'pending';
    await args.database.prepare(`UPDATE gift_card_deliveries SET status = ?, claim_token = NULL,
      lease_expires_at = NULL, completed_at = ?, updated_at = ? WHERE id = ? AND claim_token = ?`)
      .bind(status, status === 'sent' || status === 'needs_review' ? args.now : null, args.now, claimed.id, token).run();
  } catch {
    await args.database.prepare(`UPDATE gift_card_deliveries SET status = 'pending', claim_token = NULL,
      lease_expires_at = NULL, updated_at = ? WHERE id = ? AND claim_token = ?`)
      .bind(args.now, claimed.id, token).run();
  } finally {
    code = undefined;
  }
}

/** Idempotently issue every paid gift-card line and make delivery retryable. */
export async function fulfillPaidGiftCards(order: Order, options: {
  environment?: GiftCardFulfillmentEnvironment;
  now?: number;
} = {}): Promise<void> {
  const lines = order.items.filter(isGiftCardOrderLine);
  if (lines.length === 0) return;
  if (!order.id || order.payment_status !== 'paid') throw new Error('Gift-card issuance requires a paid order');
  const environment = options.environment ?? (await getCloudflareContext({ async: true })).env as unknown as GiftCardFulfillmentEnvironment;
  if (!environment.DB) throw new Error('Gift-card database is unavailable');
  const database = environment.DB;
  const repository = createGiftCardRepository(database);
  const now = options.now ?? epochSeconds();
  const deliveryKeys = parseGiftCardDeliveryKeyRing(environment);
  let hmac: GiftCardKeyRing | undefined;
  const cards: string[] = [];
  for (const line of lines) {
    if (!order.id || !line.id) throw new Error('Gift-card line lacks immutable identity');
    const id = await stableId('gift_card', order.id, line.id);
    if (!await repository.findAccountById(id)) hmac ??= parseGiftCardCodeKeyRing(environment);
    cards.push(await issueLine({ repository, order, line, hmac: hmac!, deliveryKeys, now }));
  }
  for (const giftCardId of cards) await deliverOne({ database, giftCardId, keys: deliveryKeys, now });
}

/** Retry durable pending/expired delivery claims without reissuing any card. */
export async function drainGiftCardDeliveries(options: {
  environment?: GiftCardFulfillmentEnvironment;
  now?: number;
  limit?: number;
} = {}): Promise<{ attempted: number }> {
  const environment = options.environment ?? (await getCloudflareContext({ async: true })).env as unknown as GiftCardFulfillmentEnvironment;
  if (!environment.DB) throw new Error('Gift-card database is unavailable');
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Gift-card delivery limit is invalid');
  const now = options.now ?? epochSeconds();
  const rows = await environment.DB.prepare(`SELECT gift_card_id FROM gift_card_deliveries
    WHERE status = 'pending' OR (status = 'processing' AND lease_expires_at <= ?)
    ORDER BY updated_at, id LIMIT ?`).bind(now, limit).all<{ gift_card_id: string }>();
  const keys = parseGiftCardDeliveryKeyRing(environment);
  for (const row of rows.results ?? []) {
    await deliverOne({ database: environment.DB, giftCardId: row.gift_card_id, keys, now });
  }
  return { attempted: rows.results?.length ?? 0 };
}
