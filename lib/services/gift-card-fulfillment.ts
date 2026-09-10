import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Money } from '@/lib/money';
import { createGiftCardRepository } from '@/lib/gift-cards/repository';
import {
  digestGiftCardCode,
  generateGiftCardCode,
  giftCardCodeSuffix,
  type GiftCardKeyRing,
} from '@/lib/gift-cards/code';
import {
  decryptGiftCardDeliveryCode,
  encryptGiftCardDeliveryCode,
  type GiftCardEncryptionKeyRing,
} from '@/lib/gift-cards/encryption';
import { parseGiftCardCodeKeyRing, parseGiftCardDeliveryKeyRing } from '@/lib/gift-cards/config';
import { assertGiftCardId, assertGiftCardMoney } from '@/lib/gift-cards/domain';
import {
  GIFT_CARD_MESSAGE_MAX_LENGTH,
  parseGiftCardCustomization,
  validateGiftCardRecipientEmail,
} from '@/lib/gift-cards/customization';
import { isGiftCardOrderLine } from '@/lib/gift-cards/checkout';
import { GIFT_CARD_PRODUCT_TYPE } from '@/lib/gift-cards/visibility';
import { sendEmail, type EmailSendOptions } from '@/lib/email/sender';
import { getStoreConfig } from '@/lib/store-config';
import { recordTelemetry } from '@/lib/observability/telemetry';
import type { Order } from '@/lib/types/order';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';

const DELIVERY_LEASE_SECONDS = 10 * 60;
// A delivery that keeps failing without an explicit needs-review signal (e.g. a
// permanently bouncing address) is escalated to needs_review after this many
// attempts so it stops being reclaimed on every drain cycle forever.
const MAX_DELIVERY_ATTEMPTS = 8;

interface GiftCardFulfillmentEnvironment extends Record<string, unknown> { DB?: D1Database }

/**
 * The subset of the worker env the email sender needs, taken from the drain's
 * environment — or undefined when this env carries no provider at all.
 *
 * The undefined matters: resolveRuntime branches on whether `options.env` is
 * present, not on what it holds, so any non-empty object switches off its own
 * getCloudflareContext fallback. Handing over `{ DB }` alone (a shape
 * lib/services/order-effects.ts can build) would therefore be strictly worse
 * than handing over nothing — the sender would stop looking for the EMAIL
 * binding it would otherwise have found on the request context.
 */
function emailEnvironmentFrom(
  environment: GiftCardFulfillmentEnvironment,
): EmailSendOptions['env'] | undefined {
  // Resolve the provider the way the sender does — workerEnv first, then
  // process.env (sender.ts:77). Reading only the handed env would still forward
  // a Resend key on a worker whose vars block pins EMAIL_PROVIDER=cloudflare but
  // whose env object happens not to carry it: the exact case WR-07 closed.
  const provider = typeof environment.EMAIL_PROVIDER === 'string'
    ? environment.EMAIL_PROVIDER
    : process.env.EMAIL_PROVIDER;
  // Check the binding's shape, not its truthiness. A misconfigured EMAIL var
  // (a plain string rather than a binding) would otherwise cast cleanly out of
  // Record<string, unknown>, then throw 'send is not a function' deep inside
  // the sender — a config typo turned into an indefinite retry loop.
  const emailBinding = environment.EMAIL;
  const hasSend = typeof (emailBinding as { send?: unknown } | undefined)?.send === 'function';
  // A Resend key is unusable on the Cloudflare path, and sender.ts constructs a
  // client from it before it even checks the provider. Do not carry a secret
  // through a call tree that cannot use it.
  const resendKey = provider !== 'cloudflare' && typeof environment.RESEND_API_KEY === 'string'
    ? environment.RESEND_API_KEY
    : undefined;
  if (!hasSend && resendKey === undefined) return undefined;
  return {
    ...(hasSend ? { EMAIL: emailBinding as CloudflareEnv['EMAIL'] } : {}),
    ...(environment.DB ? { DB: environment.DB } : {}),
    // sender.ts also falls back to process.env.EMAIL_PROVIDER, which
    // nodejs_compat_populate_process_env fills from the same wrangler vars
    // block, so this forwarding is not load-bearing in production — it is here
    // so the provider choice matches the env this drain actually holds. The
    // sender address is not threaded at all: deliveryMessage() reads it from
    // getStoreConfig(), which goes straight to process.env.
    ...(provider !== undefined ? { EMAIL_PROVIDER: provider } : {}),
    ...(resendKey !== undefined ? { RESEND_API_KEY: resendKey } : {}),
  };
}

function epochSeconds(): number { return Math.floor(Date.now() / 1_000); }

/**
 * Record a failed delivery attempt through the project's telemetry contract.
 *
 * Everything here is a closed enum or a bounded number, so
 * `sanitizeTelemetryFields` keeps all of it and nothing free-text can reach the
 * log stream. Three consequences of routing through `recordTelemetry` rather
 * than a bespoke console line:
 *
 *   - the envelope carries the `commerce.telemetry.v1` marker, so the tail
 *     consumer sees it at all;
 *   - `gift_card.delivery_failed` is registered critical and listed in
 *     `TAIL_CRITICAL_EVENTS`, so a permanent misconfiguration now pages someone
 *     instead of quietly burning the eight-attempt budget;
 *   - a throwable is reduced to an `error_class` from a fixed allowlist.
 *
 * There is deliberately no gift-card id: the contract has no identifier field,
 * and `sanitizeTelemetryFields` would drop one anyway. There is also no
 * provider error code — the contract has no slot for it, and the previous
 * bespoke line carried up to 200 characters of unfiltered third-party text
 * (which could include the recipient address on a rejection).
 */
type DeliveryTrigger = 'recovery' | 'request';

function recordDeliveryFailure(fields: {
  provider: 'cloudflare_email' | 'resend' | 'd1';
  retryable: boolean;
  trigger: DeliveryTrigger;
  attempt?: number;
}, error?: unknown): void {
  recordTelemetry('gift_card.delivery_failed', {
    operation: 'send',
    outcome: 'failed',
    provider: fields.provider,
    retryable: fields.retryable,
    trigger: fields.trigger,
    ...(fields.attempt === undefined ? {} : { attempt: fields.attempt }),
  }, error);
}

/**
 * Map the sender's provider name onto the telemetry provider enum. When the
 * sender could not pick a provider at all (configuration failures report none)
 * fall back to the one the environment names, so a provider-config incident is
 * attributed to email rather than to the database.
 */
function telemetryProvider(
  provider: unknown,
  configured: string | undefined,
): 'cloudflare_email' | 'resend' | 'd1' {
  const name = typeof provider === 'string' ? provider : configured;
  if (name === 'cloudflare') return 'cloudflare_email';
  if (name === 'resend') return 'resend';
  return 'd1';
}

/** Midnight-UTC epoch second of a validated YYYY-MM-DD scheduled delivery date. */
function scheduledDeliverAfter(deliveryDate: string | undefined): number {
  if (!deliveryDate) return 0;
  const [year, month, day] = deliveryDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 1_000);
}

/**
 * Deterministic id derivation shared by every gift-card issuance path.
 * Existing callers pass two discriminators (orderId, lineId); admin-create
 * (D-07, D-19) passes one (a request id). Widened to variadic rather than
 * adding a second helper, so there is exactly one derivation in this file:
 * `parts.join('\u0000')` over the original two-argument shape reproduces
 * `${orderId}\u0000${lineId}` exactly, so every existing call site's
 * output is byte-identical to before.
 */
async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(`${prefix}\u0000v1\u0000${parts.join('\u0000')}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `${prefix}_${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The buyer's gift message, read from the immutable order-line snapshot.
 *
 * `gift_card_deliveries` carries no copy of the note by design — migrations are
 * expand-only and the order snapshot is already the source of truth for every
 * other customization field. A missing, unparseable, or messageless snapshot
 * sends the card without the note rather than failing the delivery: the code
 * itself is what the recipient needs.
 */
async function giftMessageFor(args: {
  database: D1Database;
  orderId: string | null;
  orderLineId: string | null;
}): Promise<string | undefined> {
  if (!args.orderId || !args.orderLineId) return undefined;
  try {
    const row = await args.database.prepare('SELECT items FROM orders WHERE id = ?')
      .bind(args.orderId).first<{ items: string | null }>();
    if (!row?.items) return undefined;
    const items: unknown = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    if (!Array.isArray(items)) return undefined;
    const line = items.find(
      (item): item is { id: string; gift_card?: { message?: unknown } } =>
        typeof item === 'object' && item !== null
        && (item as { id?: unknown }).id === args.orderLineId,
    );
    const message = line?.gift_card?.message;
    if (typeof message !== 'string') return undefined;
    const trimmed = message.trim();
    // parseGiftCardCustomization caps this on the way in; re-clamp because this
    // is a value read back out of storage, not one that just passed the gate.
    return trimmed.length === 0 ? undefined : trimmed.slice(0, GIFT_CARD_MESSAGE_MAX_LENGTH);
  } catch (error) {
    // Fail soft -- a card without its note beats no card -- but not in silence.
    // The card still goes out, so this is a degraded send, not a failed one:
    // it must not page anyone. A schema drift on orders.items or a purged
    // order row shows up here as a non-critical envelope.
    recordTelemetry('gift_card.delivery_note_dropped', {
      operation: 'read', outcome: 'degraded', provider: 'd1', retryable: false, trigger: 'recovery',
    }, error);
    return undefined;
  }
}

function deliveryMessage(args: {
  code: string;
  amount: Money;
  recipientName?: string;
  giftMessage?: string;
}) {
  const store = getStoreConfig();
  const greeting = args.recipientName ? `Hello ${args.recipientName},` : 'Hello,';
  const subject = `${store.identity.name} gift card`;
  // The buyer's note is untrusted shopper text, and it is the only part of this
  // email the store did not write. Three things keep it contained:
  //
  //   1. It is attributed, so it can never read as store copy.
  //   2. It sits *below* the code block and its "keep this private" line, so
  //      nothing buyer-authored is ever framed as instructions about the code.
  //   3. It is HTML-escaped line by line, never interpolated raw. Links are
  //      rejected upstream by parseGiftCardCustomization (text/plain clients
  //      autolink bare URLs, so escaping alone would not be enough there).
  const noteText = args.giftMessage
    ? `\n\nMessage from the sender:\n\n"${args.giftMessage}"`
    : '';
  const noteHtml = args.giftMessage
    ? `<p>Message from the sender:</p><blockquote>${args.giftMessage.split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${escapeHtmlText(line)}</p>`)
        .join('')}</blockquote>`
    : '';
  return {
    from: store.contact.senderEmail,
    to: '',
    subject,
    text: `${greeting}\n\nYou received a ${args.amount.format()} gift card.\n\nCode: ${args.code}\n\nKeep this code private.${noteText}`,
    html: `<p>${escapeHtmlText(greeting)}</p><p>You received a ${escapeHtmlText(args.amount.format())} gift card.</p><p><strong>${escapeHtmlText(args.code)}</strong></p><p>Keep this code private.</p>${noteHtml}`,
  };
}

async function issueLine(args: {
  repository: ReturnType<typeof createGiftCardRepository>;
  order: Order;
  line: Order['items'][number];
  resolveHmac: () => GiftCardKeyRing;
  deliveryKeys: GiftCardEncryptionKeyRing;
  now: number;
}): Promise<string> {
  const recipient = args.line.gift_card;
  if (!args.order.id || !args.line.id || !recipient) throw new Error('Gift-card order snapshot is invalid');
  const giftCardId = await stableId('gift_card', args.order.id, args.line.id);
  const existing = await args.repository.findAccountById(giftCardId);
  if (existing) return giftCardId;
  const deliveryId = await stableId('gift_delivery', args.order.id, args.line.id);
  const deliverAfter = scheduledDeliverAfter(recipient.deliveryDate);
  // Strings cannot be reliably zeroized in JS; keep the code's scope minimal
  // and never return, store, log, or attach the bearer code to an error.
  const code = generateGiftCardCode();
  const codeHash = await digestGiftCardCode(code, args.resolveHmac());
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
    // D-02: the second of the two issuance paths that carry a code suffix —
    // issueAdminGiftCard is the first. Pre-0024 cards stay NULL (no backfill).
    codeSuffix: giftCardCodeSuffix(code) ?? undefined,
    delivery: {
      id: deliveryId,
      recipientEmail: recipient.recipientEmail,
      ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
      emailIdempotencyKey: `gift-card-delivery/${giftCardId}/v1`,
      codeCiphertext: encrypted.ciphertext,
      codeNonce: encrypted.nonce,
      codeKeyVersion: encrypted.keyVersion,
      ...(deliverAfter > 0 ? { deliverAfter } : {}),
    },
  });
  return giftCardId;
}

export interface IssueAdminGiftCardResult {
  giftCardId: string;
  created: boolean;
}

/**
 * D-07: the ceiling on an amount admin-create can mint. There is no
 * STORE_GIFT_CARD_MAX_MINOR constant anywhere in this repository, so D-07's
 * stated fallback applies — the gift-card product's highest configured
 * denomination — and it is read from the catalogue at call time
 * (`resolveGiftCardAdminIssueMaxMinor`) rather than pinned to seed data, so a
 * store that sells a different set of denominations gets a matching ceiling
 * without a code change (WR-04). This literal is the last resort only, for a
 * catalogue with no active gift-card variant in the requested currency.
 */
const GIFT_CARD_ADMIN_ISSUE_FALLBACK_MAX_MINOR = 20_000;

/**
 * The highest active gift-card denomination in `currency`, in minor units,
 * from the same `products`/`product_variants` rows checkout sells from
 * (`products.type = 'gift_card'`, variant `price` JSON in minor units).
 */
export async function resolveGiftCardAdminIssueMaxMinor(
  database: D1Database,
  currency: string,
): Promise<number> {
  const row = await database.prepare(`SELECT MAX(json_extract(variant.price, '$.amount')) AS max_minor
    FROM product_variants variant
    JOIN products product ON product.id = variant.product_id
    WHERE product.type = ? AND product.status = 'active' AND variant.status = 'active'
      AND upper(json_extract(variant.price, '$.currency')) = ?`)
    .bind(GIFT_CARD_PRODUCT_TYPE, currency.toUpperCase())
    .first<{ max_minor: number | null }>();
  const max = row?.max_minor;
  return typeof max === 'number' && Number.isSafeInteger(max) && max > 0
    ? max
    : GIFT_CARD_ADMIN_ISSUE_FALLBACK_MAX_MINOR;
}

/**
 * D-07/D-19: issue a gift card with no order behind it, through the exact
 * machinery `issueLine` uses for a purchased one — same code generation, same
 * AAD-bound encryption, same `issueAccount` call, same pending-delivery row
 * the existing cron drain later claims and sends with no change to the
 * drain. `issueAccount` derives its own `issuance_business_key` from the id
 * it is given (RESEARCH Pitfall 2), so idempotency here comes from a
 * deterministic card id derived from the caller's `requestId`: the same
 * `requestId` always re-derives the same id, and `findAccountById`
 * short-circuits a retry the same way `issueLine` does.
 */
export async function issueAdminGiftCard(args: {
  requestId: string;
  amount: Money;
  recipientEmail: string;
  recipientName?: string;
  environment: GiftCardFulfillmentEnvironment;
  now?: number;
}): Promise<IssueAdminGiftCardResult> {
  assertGiftCardId(args.requestId, 'gift-card admin request id');
  if (!args.environment.DB) throw new Error('Gift-card database is unavailable');
  const database = args.environment.DB;
  const repository = createGiftCardRepository(database);
  const now = args.now ?? epochSeconds();

  const giftCardId = await stableId('gift_card_admin', args.requestId);
  const existing = await repository.findAccountById(giftCardId);
  if (existing) return { giftCardId, created: false };

  assertGiftCardMoney(args.amount, { positive: true });
  const maxMinor = await resolveGiftCardAdminIssueMaxMinor(database, args.amount.currency);
  if (args.amount.toMinorUnits() > maxMinor) {
    throw new RangeError(`Gift-card admin issuance amount exceeds the configured maximum of ${maxMinor} minor units`);
  }
  // Reuses the same whole-object validator checkout uses (parseGiftCardCustomization)
  // rather than a second email regex; it also normalizes (trims, lowercases) the
  // address the same way a checkout-issued card's recipient is normalized.
  const recipient = parseGiftCardCustomization({
    recipientEmail: args.recipientEmail,
    ...(args.recipientName ? { recipientName: args.recipientName } : {}),
  });

  const deliveryId = await stableId('gift_delivery_admin', args.requestId);
  // Strings cannot be reliably zeroized in JS; keep the code's scope minimal
  // and never return, store, log, or attach the bearer code to an error.
  const code = generateGiftCardCode();
  const codeHash = await digestGiftCardCode(code, parseGiftCardCodeKeyRing(args.environment));
  if (!codeHash) throw new Error('Generated gift-card code is invalid');
  const encrypted = await encryptGiftCardDeliveryCode({
    giftCardId, deliveryId, code, keyRing: parseGiftCardDeliveryKeyRing(args.environment),
  });
  await repository.issueAccount({
    id: giftCardId,
    codeHash,
    amount: args.amount,
    createdAt: now,
    codeSuffix: giftCardCodeSuffix(code) ?? undefined,
    delivery: {
      id: deliveryId,
      recipientEmail: recipient.recipientEmail,
      ...(recipient.recipientName ? { recipientName: recipient.recipientName } : {}),
      emailIdempotencyKey: `gift-card-delivery/${giftCardId}/v1`,
      codeCiphertext: encrypted.ciphertext,
      codeNonce: encrypted.nonce,
      codeKeyVersion: encrypted.keyVersion,
      // deliverAfter intentionally unset (defaults to 0): an admin-created
      // card sends immediately once the cron drain next runs, exactly like
      // an unscheduled checkout purchase.
    },
  });
  return { giftCardId, created: true };
}

async function deliverOne(args: {
  database: D1Database;
  giftCardId: string;
  keys: GiftCardEncryptionKeyRing;
  now: number;
  emailEnvironment: EmailSendOptions['env'] | undefined;
  trigger: DeliveryTrigger;
}): Promise<void> {
  const token = crypto.randomUUID();
  const claimed = await args.database.prepare(`UPDATE gift_card_deliveries
    SET status = 'processing', attempt_count = attempt_count + 1, claim_token = ?,
        lease_expires_at = ?, updated_at = ?
    WHERE gift_card_id = ? AND deliver_after <= ?
      AND (status = 'pending' OR (status = 'processing' AND lease_expires_at <= ?))
    RETURNING id, order_id, order_line_id, recipient_email, recipient_name,
      email_idempotency_key, code_ciphertext, code_nonce, code_key_version, attempt_count`).bind(
    token, args.now + DELIVERY_LEASE_SECONDS, args.now, args.giftCardId, args.now, args.now,
  ).first<{
    id: string; order_id: string | null; order_line_id: string | null;
    recipient_email: string; recipient_name: string | null; email_idempotency_key: string;
    code_ciphertext: string | null; code_nonce: string | null; code_key_version: number | null;
    attempt_count: number;
  }>();
  if (!claimed) return;
  // attempt_count is post-increment (SQLite RETURNING sees the new row). Once a
  // non-terminal failure has exhausted the retry budget, park for review.
  const exhausted = claimed.attempt_count >= MAX_DELIVERY_ATTEMPTS;
  if (!claimed.code_ciphertext || !claimed.code_nonce || !claimed.code_key_version) {
    // Terminal on the first attempt, so it never reaches the retry budget that
    // would eventually surface it: a paid card whose encrypted code material is
    // gone needs a human to reissue it, and nobody was being told.
    recordDeliveryFailure({
      provider: 'd1', retryable: false, trigger: args.trigger, attempt: claimed.attempt_count,
    });
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
    const giftMessage = await giftMessageFor({
      database: args.database, orderId: claimed.order_id, orderLineId: claimed.order_line_id,
    });
    const message = deliveryMessage({
      code, amount: Money.fromMinor(account.issued_amount_minor, account.currency_code),
      ...(claimed.recipient_name ? { recipientName: claimed.recipient_name } : {}),
      ...(giftMessage ? { giftMessage } : {}),
    });
    // The drain runs from the scheduled (cron) handler, where there is no
    // request context for the sender to read bindings from; hand it the
    // worker env explicitly or it cannot find the EMAIL binding or the DB.
    const result = await sendEmail({ ...message, to: claimed.recipient_email }, {
      idempotencyKey: claimed.email_idempotency_key,
      env: args.emailEnvironment,
    });
    const status = result.success ? 'sent' : (result.needsReview || exhausted) ? 'needs_review' : 'pending';
    if (!result.success) {
      // The retry/status decision above is unchanged; this only records it.
      recordDeliveryFailure({
        provider: telemetryProvider(result.provider, args.emailEnvironment?.EMAIL_PROVIDER),
        retryable: status !== 'needs_review',
        trigger: args.trigger,
        attempt: claimed.attempt_count,
      });
    }
    await args.database.prepare(`UPDATE gift_card_deliveries SET status = ?, claim_token = NULL,
      lease_expires_at = NULL, completed_at = ?, updated_at = ? WHERE id = ? AND claim_token = ?`)
      .bind(status, status === 'sent' || status === 'needs_review' ? args.now : null, args.now, claimed.id, token).run();
  } catch (error) {
    const status = exhausted ? 'needs_review' : 'pending';
    recordDeliveryFailure({
      provider: 'd1', retryable: !exhausted, trigger: args.trigger, attempt: claimed.attempt_count,
    }, error);
    await args.database.prepare(`UPDATE gift_card_deliveries SET status = ?, claim_token = NULL,
      lease_expires_at = NULL, completed_at = ?, updated_at = ? WHERE id = ? AND claim_token = ?`)
      .bind(status, exhausted ? args.now : null, args.now, claimed.id, token).run();
  } finally {
    code = undefined;
  }
}

export type ResendGiftCardDeliveryResult =
  | { sent: true }
  | { sent: false; reason: 'not_resendable' | 'code_unavailable' | 'send_failed' };

interface ResendDeliveryRow {
  id: string;
  gift_card_id: string;
  order_id: string | null;
  order_line_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  code_ciphertext: string | null;
  code_nonce: string | null;
  code_key_version: number | null;
}

/**
 * D-08/D-21: send the same delivery email again, to the original recipient
 * or an admin-supplied address, without modifying the delivery row and
 * without the sender's D1-row-backed dedupe swallowing the resend (a fresh,
 * caller-supplied idempotency key is required — reusing the row's own
 * `email_idempotency_key` would short-circuit to a false success with no
 * provider call, RESEARCH anti-pattern).
 *
 * `environment` must be the full worker env (`getCloudflareContext().env`)
 * the caller obtained — never a `{ DB }`-only object. `emailEnvironmentFrom`
 * branches on whether ANY env was supplied at all, so a partial one switches
 * off its own `getCloudflareContext` fallback and loses the EMAIL binding —
 * the same constraint `deliverOne`'s callers already honor.
 */
export async function resendGiftCardDelivery(args: {
  deliveryId: string;
  to?: string;
  idempotencyKey: string;
  environment: GiftCardFulfillmentEnvironment;
  now?: number;
}): Promise<ResendGiftCardDeliveryResult> {
  assertGiftCardId(args.deliveryId, 'gift-card delivery id');
  if (
    typeof args.idempotencyKey !== 'string'
    || args.idempotencyKey.trim().length === 0
    || args.idempotencyKey.length > 256
  ) {
    throw new TypeError('Gift-card resend idempotency key is invalid');
  }
  if (args.to !== undefined && validateGiftCardRecipientEmail(args.to) !== null) {
    throw new TypeError('Gift-card resend recipient address is invalid');
  }
  if (!args.environment.DB) throw new Error('Gift-card database is unavailable');
  const database = args.environment.DB;

  const row = await database.prepare(`SELECT id, gift_card_id, order_id, order_line_id,
    recipient_email, recipient_name, status, code_ciphertext, code_nonce, code_key_version
    FROM gift_card_deliveries WHERE id = ? LIMIT 1`).bind(args.deliveryId).first<ResendDeliveryRow>();
  if (!row || (row.status !== 'sent' && row.status !== 'needs_review')) {
    return { sent: false, reason: 'not_resendable' };
  }
  if (!row.code_ciphertext || !row.code_nonce || !row.code_key_version) {
    return { sent: false, reason: 'code_unavailable' };
  }

  let code: string | undefined;
  try {
    let decrypted: string;
    try {
      decrypted = await decryptGiftCardDeliveryCode({
        giftCardId: row.gift_card_id,
        deliveryId: row.id,
        encrypted: { keyVersion: row.code_key_version, nonce: row.code_nonce, ciphertext: row.code_ciphertext },
        keyRing: parseGiftCardDeliveryKeyRing(args.environment),
      });
    } catch {
      return { sent: false, reason: 'code_unavailable' };
    }
    code = decrypted;
    const account = await database.prepare(`SELECT issued_amount_minor, currency_code
      FROM gift_card_accounts WHERE id = ?`).bind(row.gift_card_id)
      .first<{ issued_amount_minor: number; currency_code: string }>();
    if (!account) return { sent: false, reason: 'code_unavailable' };
    const giftMessage = await giftMessageFor({
      database, orderId: row.order_id, orderLineId: row.order_line_id,
    });
    const message = deliveryMessage({
      code,
      amount: Money.fromMinor(account.issued_amount_minor, account.currency_code),
      ...(row.recipient_name ? { recipientName: row.recipient_name } : {}),
      ...(giftMessage ? { giftMessage } : {}),
    });
    const result = await sendEmail({ ...message, to: args.to ?? row.recipient_email }, {
      idempotencyKey: args.idempotencyKey,
      env: emailEnvironmentFrom(args.environment),
    });
    return result.success ? { sent: true } : { sent: false, reason: 'send_failed' };
  } finally {
    code = undefined;
  }
}

/**
 * D-12: whether a delivery's retained code material exists for this card, with
 * no ciphertext ever crossing into the caller. Deliberately split from
 * `revealGiftCardDeliveryCode` below so a caller (the reveal route) can
 * refuse a card with nothing to reveal, write its audit event, and only then
 * decrypt — the D-12 ordering requires the availability check and the
 * decrypt to be two separate round trips, not one.
 *
 * This module (not `app/api/admin/gift-cards/`) is deliberately where every
 * `code_ciphertext`/`code_nonce`/`code_key_version` column reference lives —
 * the same placement `resendGiftCardDelivery` already uses — so the admin
 * route directory the D-14 forbidden-column source contract scans never
 * contains those column names itself.
 */
export async function giftCardDeliveryHasStoredCode(args: {
  giftCardId: string;
  environment: GiftCardFulfillmentEnvironment;
}): Promise<boolean> {
  assertGiftCardId(args.giftCardId, 'gift-card id');
  if (!args.environment.DB) throw new Error('Gift-card database is unavailable');
  const row = await args.environment.DB.prepare(`SELECT id, code_ciphertext, code_nonce, code_key_version
    FROM gift_card_deliveries WHERE gift_card_id = ? LIMIT 1`).bind(args.giftCardId).first<{
      id: string; code_ciphertext: string | null; code_nonce: string | null; code_key_version: number | null;
    }>();
  return Boolean(row?.code_ciphertext && row?.code_nonce && row?.code_key_version);
}

/**
 * D-12: decrypt and return the retained bearer code for a super-admin reveal.
 * Callers must have already confirmed `giftCardDeliveryHasStoredCode` and
 * written the `code_revealed` audit event — this function does the one thing
 * left, and does it last. Never logs, stores, or attaches the returned code
 * to an error; `decryptGiftCardDeliveryCode` zeroizes its own key material.
 */
export async function revealGiftCardDeliveryCode(args: {
  giftCardId: string;
  environment: GiftCardFulfillmentEnvironment;
}): Promise<string> {
  assertGiftCardId(args.giftCardId, 'gift-card id');
  if (!args.environment.DB) throw new Error('Gift-card database is unavailable');
  const row = await args.environment.DB.prepare(`SELECT id, code_ciphertext, code_nonce, code_key_version
    FROM gift_card_deliveries WHERE gift_card_id = ? LIMIT 1`).bind(args.giftCardId).first<{
      id: string; code_ciphertext: string | null; code_nonce: string | null; code_key_version: number | null;
    }>();
  if (!row || !row.code_ciphertext || !row.code_nonce || !row.code_key_version) {
    throw new Error('Gift-card delivery has no retained code to reveal');
  }
  return decryptGiftCardDeliveryCode({
    giftCardId: args.giftCardId,
    deliveryId: row.id,
    encrypted: { keyVersion: row.code_key_version, nonce: row.code_nonce, ciphertext: row.code_ciphertext },
    keyRing: parseGiftCardDeliveryKeyRing(args.environment),
  });
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
  // Resolve the HMAC ring lazily: a fully re-run (all cards already issued)
  // order effect never needs the code secret.
  let hmac: GiftCardKeyRing | undefined;
  const resolveHmac = () => (hmac ??= parseGiftCardCodeKeyRing(environment));
  const cards: string[] = [];
  for (const line of lines) {
    if (!order.id || !line.id) throw new Error('Gift-card line lacks immutable identity');
    cards.push(await issueLine({ repository, order, line, resolveHmac, deliveryKeys, now }));
  }
  // Cards with a future scheduled date are claimed only once due; the scheduler
  // drain picks them up. Immediate cards send here.
  const emailEnvironment = emailEnvironmentFrom(environment);
  for (const giftCardId of cards) {
    await deliverOne({ database, giftCardId, keys: deliveryKeys, now, emailEnvironment, trigger: 'request' });
  }
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
    WHERE deliver_after <= ?
      AND (status = 'pending' OR (status = 'processing' AND lease_expires_at <= ?))
    ORDER BY updated_at, id LIMIT ?`).bind(now, now, limit).all<{ gift_card_id: string }>();
  const keys = parseGiftCardDeliveryKeyRing(environment);
  const emailEnvironment = emailEnvironmentFrom(environment);
  for (const row of rows.results ?? []) {
    await deliverOne({ database: environment.DB, giftCardId: row.gift_card_id, keys, now, emailEnvironment, trigger: 'recovery' });
  }
  return { attempted: rows.results?.length ?? 0 };
}
