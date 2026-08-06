import { getCloudflareContext } from '@opennextjs/cloudflare';
import type Stripe from 'stripe';
import { Money } from '@/lib/money';
import { sendRefundSettledEmail, type RefundSettledEmailInput } from '@/lib/payments/refund-email';
import {
  decideRefundLifecycle,
  type ProviderRefundSnapshot,
  type RefundLifecycleDecision,
} from '@/lib/payments/refund-lifecycle';
import {
  parseRefundExtensions,
  readRefundsVersion,
} from '@/lib/payments/refund-ledger-store';
import { getStripeClient } from '@/lib/stripe';
import { MAX_REFUND_RECORDS, type RefundRecord } from '@/lib/utils/refund-validation';
import type { WebhookEventOutcome } from '@/lib/webhooks/processed-events';

const MAX_LIFECYCLE_CAS_ATTEMPTS = 5;
const EXTERNAL_RESTOCK_SETTING = 'refund.external_full_restock_enabled';

interface RefundOrderRow {
  id: string;
  status: string;
  payment_status: string | null;
  total_amount: string;
  currency_code: string;
  items: string;
  external_references: string | null;
  extensions: string | null;
  shipping_address: string | null;
  updated_at: string | null;
}

interface OrderLine {
  id: string;
  variantId: string;
  quantity: number;
}

export interface RefundWebhookRuntime {
  database?: D1Database;
  stripe?: Stripe;
  externalRestockEnabled?: boolean;
  sendEmail?: (input: RefundSettledEmailInput) => Promise<{ success: boolean; error?: string }>;
  now?: () => Date;
}

async function resolveDatabase(database?: D1Database): Promise<D1Database> {
  if (database) return database;
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function expandableId(value: { id: string } | string | null): string | null {
  if (typeof value === 'string') return value || null;
  return value?.id || null;
}

function parseJson(value: string | null, name: string): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} contains malformed JSON`);
  }
}

function parseOrderLines(value: string): OrderLine[] {
  const raw = parseJson(value, 'Order items');
  if (!Array.isArray(raw) || raw.length > 100) throw new Error('Order items are invalid');
  const lines = raw.map((item): OrderLine => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Order contains an invalid line');
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id
      ? record.id
      : `${String(record.product_id ?? '')}-${String(record.variant_id ?? 'default')}`;
    const variantId = record.variant_id;
    const quantity = record.quantity;
    if (!id || id.length > 128 || typeof variantId !== 'string' || !variantId ||
        variantId.length > 256 || !Number.isSafeInteger(quantity) || Number(quantity) <= 0) {
      throw new Error('Order contains an invalid refundable line');
    }
    return { id, variantId, quantity: Number(quantity) };
  });
  if (new Set(lines.map(({ id }) => id)).size !== lines.length) {
    throw new Error('Order line ids are ambiguous');
  }
  return lines;
}

async function findOrderByPaymentIntent(
  database: D1Database,
  paymentIntentId: string
): Promise<RefundOrderRow | null> {
  const rows = await database.prepare(`
SELECT id, status, payment_status, total_amount, currency_code, items,
       external_references, extensions, shipping_address, updated_at
FROM orders
WHERE json_valid(COALESCE(external_references, '{}')) = 1
  AND json_valid(COALESCE(extensions, '{}')) = 1
  AND json_extract(external_references, '$.payment_intent_id') = ?
  AND json_extract(extensions, '$.payment_intent_id') = ?
LIMIT 2
`).bind(paymentIntentId, paymentIntentId).all<RefundOrderRow>();
  if (rows.results.length > 1) {
    throw new Error(`PaymentIntent ${paymentIntentId} is bound to multiple orders`);
  }
  return rows.results[0] ?? null;
}

export async function readExternalRestockEnabled(database: D1Database): Promise<boolean> {
  const setting = await database.prepare(
    'SELECT value FROM admin_settings WHERE key = ?'
  ).bind(EXTERNAL_RESTOCK_SETTING).first<{ value: string }>();
  if (!setting) return false;
  let value: unknown;
  try {
    value = JSON.parse(setting.value);
  } catch {
    throw new Error('External refund restock setting contains malformed JSON');
  }
  if (typeof value !== 'boolean') {
    throw new Error('External refund restock setting must be boolean');
  }
  return value;
}

function providerSnapshot(
  refund: Stripe.Refund,
  paymentIntentId: string,
  chargeId: string,
  currency: string
): ProviderRefundSnapshot {
  const refundPaymentIntentId = expandableId(refund.payment_intent);
  const refundChargeId = expandableId(refund.charge);
  if (refundPaymentIntentId !== paymentIntentId || refundChargeId !== chargeId ||
      refund.currency.toLowerCase() !== currency.toLowerCase() ||
      !Number.isSafeInteger(refund.created) || refund.created < 0) {
    throw new Error(`Stripe refund ${refund.id} conflicts with its charge binding`);
  }
  if (!refund.status) throw new Error(`Stripe refund ${refund.id} has no status`);
  const requestId = refund.metadata?.refundRequestId;
  return {
    id: refund.id,
    amount: refund.amount,
    status: refund.status,
    paymentIntentId,
    ...(typeof requestId === 'string' && requestId ? { requestId } : {}),
    createdAt: new Date(refund.created * 1_000).toISOString(),
  };
}

function refundContext(row: RefundOrderRow): { email?: string; name?: string } {
  const extensions = parseRefundExtensions(row.extensions) ?? {};
  const address = parseJson(row.shipping_address, 'Shipping address');
  const shipping = address !== null && typeof address === 'object' && !Array.isArray(address)
    ? address as Record<string, unknown>
    : {};
  const email = typeof extensions.email === 'string'
    ? extensions.email
    : typeof shipping.email === 'string' ? shipping.email : undefined;
  const name = typeof shipping.recipient === 'string'
    ? shipping.recipient
    : typeof shipping.company === 'string' ? shipping.company : undefined;
  return { ...(email ? { email } : {}), ...(name ? { name } : {}) };
}

function restockInsert(
  database: D1Database,
  row: RefundOrderRow,
  line: OrderLine,
  nextVersion: number,
  settledRefundIds: string[],
  nowIso: string
): D1PreparedStatement {
  return database.prepare(`
INSERT INTO inventory_adjustments (
  adjustment_key, order_id, line_id, variant_id, kind, quantity,
  status, attempt_count, claim_token, lease_expires_at, next_attempt_at,
  result, last_error, created_at, updated_at, completed_at
)
SELECT ?, ?, ?, ?, 'refund_restock', ?,
       'pending', 0, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL
WHERE EXISTS (
  SELECT 1
  FROM orders o, json_each(o.extensions, '$.refunds') refund
  WHERE o.id = ?
    AND json_extract(o.extensions, '$.refunds_version') = ?
    AND json_extract(refund.value, '$.status') = 'succeeded'
    AND json_extract(refund.value, '$.stripe_refund_id') IN (
      SELECT value FROM json_each(?)
    )
)
ON CONFLICT(adjustment_key) DO NOTHING
`).bind(
    `restock:${row.id}:${line.id}:v1`,
    row.id,
    line.id,
    line.variantId,
    line.quantity,
    nowIso,
    nowIso,
    row.id,
    nextVersion,
    JSON.stringify(settledRefundIds)
  );
}

export async function applyRefundLifecycleToOrder(
  args: {
    database: D1Database;
    paymentIntentId: string;
    providerCurrency: string;
    providerRefunds: ProviderRefundSnapshot[];
    chargeAmountRefunded: number;
    mode: 'charge' | 'lifecycle';
    targetRefundId?: string;
    externalRestockEnabled: boolean;
    now?: () => Date;
  }
): Promise<{ row: RefundOrderRow; decision: RefundLifecycleDecision } | null> {
  for (let attempt = 0; attempt < MAX_LIFECYCLE_CAS_ATTEMPTS; attempt += 1) {
    const row = await findOrderByPaymentIntent(args.database, args.paymentIntentId);
    if (!row) return null;
    if (!args.providerCurrency ||
        row.currency_code.toLowerCase() !== args.providerCurrency.toLowerCase() ||
        args.providerRefunds.some(({ paymentIntentId }) => paymentIntentId !== args.paymentIntentId)) {
      throw new Error('Stripe refund binding conflicts with the order currency or PaymentIntent');
    }
    const extensions = parseRefundExtensions(row.extensions);
    if (!extensions) throw new Error('Order extensions are invalid');
    const rawRefunds = extensions.refunds ?? [];
    if (!Array.isArray(rawRefunds) || rawRefunds.length > MAX_REFUND_RECORDS) {
      throw new Error('Order refund ledger is invalid');
    }
    const version = readRefundsVersion(extensions);
    if (version === null || version === Number.MAX_SAFE_INTEGER) {
      throw new Error('Order refund version is invalid');
    }
    const lines = parseOrderLines(row.items);
    const totalAmount = Money.fromStored(
      parseJson(row.total_amount, 'Order total'),
      row.currency_code
    ).toMinorUnits();
    const nowIso = (args.now?.() ?? new Date()).toISOString();
    const decision = decideRefundLifecycle({
      mode: args.mode,
      refunds: rawRefunds as RefundRecord[],
      providerRefunds: args.providerRefunds,
      ...(args.targetRefundId ? { targetRefundId: args.targetRefundId } : {}),
      chargeAmountRefunded: args.chargeAmountRefunded,
      totalAmount,
      orderLineIds: lines.map(({ id }) => id),
      externalRestockEnabled: args.externalRestockEnabled,
      nowIso,
    });
    const nextVersion = version + 1;
    const nextExtensions = JSON.stringify({
      ...extensions,
      refunds: decision.refunds,
      refunds_version: nextVersion,
      stripe_amount_refunded: decision.stripeAmountRefunded,
    });
    const update = args.database.prepare(`
UPDATE orders
SET extensions = ?,
    status = CASE WHEN ? = 1 THEN 'cancelled' ELSE status END,
    payment_status = CASE WHEN ? = 1 THEN 'refunded' ELSE payment_status END,
    updated_at = ?
WHERE id = ?
  AND updated_at IS ?
  AND COALESCE(json_extract(extensions, '$.refunds_version'), 0) = ?
`).bind(
      nextExtensions,
      decision.fullyRefunded ? 1 : 0,
      decision.fullyRefunded ? 1 : 0,
      nowIso,
      row.id,
      row.updated_at,
      version
    );
    const settledIds = decision.settledRefunds.map(({ id }) => id);
    const byId = new Map(lines.map((line) => [line.id, line]));
    const inserts = decision.restockLineIds.map((lineId) => {
      const line = byId.get(lineId);
      if (!line) throw new Error(`Refund restock line ${lineId} is missing from the order`);
      return restockInsert(args.database, row, line, nextVersion, settledIds, nowIso);
    });
    const results = await args.database.batch([update, ...inserts]);
    if (results[0]?.meta.changes === 1) {
      return { row: { ...row, extensions: nextExtensions, updated_at: nowIso }, decision };
    }
  }
  throw new Error('Refund lifecycle CAS attempts exhausted');
}

async function sendSettlementNotifications(
  row: RefundOrderRow,
  decision: RefundLifecycleDecision,
  sendEmail: NonNullable<RefundWebhookRuntime['sendEmail']>
): Promise<void> {
  const customer = refundContext(row);
  for (const refund of decision.settledRefunds) {
    const result = await sendEmail({
      orderId: row.id,
      refundId: refund.id,
      amount: refund.amount,
      currencyCode: row.currency_code,
      ...(customer.email ? { customerEmail: customer.email } : {}),
      ...(customer.name ? { customerName: customer.name } : {}),
    });
    if (!result.success) throw new Error(result.error || 'Refund notification failed');
  }
}

export async function handleChargeRefunded(
  eventCharge: Stripe.Charge,
  runtime: RefundWebhookRuntime = {}
): Promise<WebhookEventOutcome> {
  const paymentIntentId = expandableId(eventCharge.payment_intent);
  if (!paymentIntentId || !eventCharge.id) return 'permanent_rejection';
  const database = await resolveDatabase(runtime.database);
  const stripe = runtime.stripe ?? getStripeClient();
  const listed = await stripe.refunds.list({ charge: eventCharge.id, limit: 100 });
  if (listed.has_more || listed.data.length > 100) {
    throw new Error('Stripe charge has more refunds than the bounded reconciler supports');
  }
  const providerRefunds = listed.data.map((refund) =>
    providerSnapshot(refund, paymentIntentId, eventCharge.id, eventCharge.currency)
  );
  const externalRestockEnabled = runtime.externalRestockEnabled ??
    await readExternalRestockEnabled(database);
  const persisted = await applyRefundLifecycleToOrder({
    database,
    paymentIntentId,
    providerCurrency: eventCharge.currency,
    providerRefunds,
    chargeAmountRefunded: eventCharge.amount_refunded,
    mode: 'charge',
    externalRestockEnabled,
    now: runtime.now,
  });
  if (!persisted) return 'permanent_rejection';
  await sendSettlementNotifications(
    persisted.row,
    persisted.decision,
    runtime.sendEmail ?? sendRefundSettledEmail
  );
  return 'handled';
}

export async function handleRefundLifecycle(
  eventRefund: Stripe.Refund,
  runtime: RefundWebhookRuntime = {}
): Promise<WebhookEventOutcome> {
  const chargeId = expandableId(eventRefund.charge);
  if (!chargeId || !eventRefund.id) return 'permanent_rejection';
  const database = await resolveDatabase(runtime.database);
  const stripe = runtime.stripe ?? getStripeClient();
  const [refund, charge] = await Promise.all([
    stripe.refunds.retrieve(eventRefund.id),
    stripe.charges.retrieve(chargeId),
  ]);
  const paymentIntentId = expandableId(charge.payment_intent);
  if (!paymentIntentId) return 'permanent_rejection';
  const provider = providerSnapshot(refund, paymentIntentId, charge.id, charge.currency);
  const externalRestockEnabled = runtime.externalRestockEnabled ??
    await readExternalRestockEnabled(database);
  const persisted = await applyRefundLifecycleToOrder({
    database,
    paymentIntentId,
    providerCurrency: charge.currency,
    providerRefunds: [provider],
    chargeAmountRefunded: charge.amount_refunded,
    mode: 'lifecycle',
    targetRefundId: eventRefund.id,
    externalRestockEnabled,
    now: runtime.now,
  });
  if (!persisted) return 'permanent_rejection';
  await sendSettlementNotifications(
    persisted.row,
    persisted.decision,
    runtime.sendEmail ?? sendRefundSettledEmail
  );
  return persisted.decision.matchedTarget ? 'handled' : 'ignored';
}
