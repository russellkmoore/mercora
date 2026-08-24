import { Money } from '@/lib/money';
import type { VerifiedSubscriptionInvoice } from '@/lib/subscriptions/domain';
import {
  assertShippingAddress,
  assertVerifiedSubscriptionInvoice,
} from '@/lib/subscriptions/domain';
import { SUBSCRIPTION_ACQUISITION_EXTENSION } from '@/lib/commerce/capabilities';
import {
  preparePaidOrderEffectStatements,
} from '@/lib/services/order-effects';
import type { Address } from '@/lib/types';
import type { Order, OrderItem } from '@/lib/types/order';

interface InvoiceSubscriptionContextRow {
  subscription_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  customer_id: string;
  acquisition_id: string;
  plan_id: string;
  product_id: string;
  variant_id: string;
  currency_code: string;
  unit_amount_minor: number;
  stripe_price_id: string;
  cadence_unit: 'day' | 'week' | 'month' | 'year';
  cadence_count: number;
  quantity: number;
  shipping_address: string | null;
  customer_person: string | null;
  customer_company: string | null;
  customer_contacts: string | null;
  product_name: string;
  sku: string;
  shipping_required: number | null;
}

interface ExistingInvoiceOrderRow {
  stripe_invoice_id: string;
  subscription_id: string;
  order_id: string;
  stripe_payment_intent_id: string | null;
  paid_amount_minor: number;
  currency_code: string;
  period_start: number | null;
  period_end: number | null;
  verified_paid_at: number;
  status: Order['status'];
  payment_status: Order['payment_status'];
  total_amount: string;
  customer_id: string | null;
  payment_method: string | null;
  items: string;
  shipping_address: string | null;
  external_references: string | null;
  extensions: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SubscriptionInvoiceProvider {
  retrieveVerifiedInvoice(args: {
    stripeInvoiceId: string;
    expectedSubscriptionId: string;
    expectedStripeCustomerId: string;
    expectedStripePriceId: string;
    expectedUnitPrice: Money;
    expectedQuantity: number;
  }): Promise<VerifiedSubscriptionInvoice>;
}

export interface FulfillSubscriptionInvoiceArgs {
  database: D1Database;
  provider: SubscriptionInvoiceProvider;
  stripeInvoiceId: string;
  /** Signed invoice routing hint; the provider read must verify it exactly. */
  stripeSubscriptionId: string;
}

export interface FulfillSubscriptionInvoiceResult {
  order: Order;
  created: boolean;
}

export interface SubscriptionInvoiceEventCursor {
  id: string;
  createdAt: number;
}

export interface SubscriptionInvoiceFailureDecision {
  outcome: 'applied' | 'duplicate' | 'ignored_stale';
  notify: boolean;
}

export type SubscriptionInvoiceRecoveryDecision =
  | { recovered: false }
  | { recovered: true; outcome: 'applied' | 'duplicate' };

function assertProviderId(value: string, prefix: string, label: string): void {
  if (typeof value !== 'string' || !value.startsWith(prefix) ||
      value.length <= prefix.length || value.length > 255 || value.trim() !== value) {
    throw new TypeError(`${label} must be a bounded ${prefix} identifier`);
  }
}

function parseJson<T>(value: string | null, label: string): T | undefined {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} contains malformed JSON`);
  }
}

function productName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Subscription product has no name');
  if (!trimmed.startsWith('{')) return trimmed;
  const localized = parseJson<Record<string, unknown>>(trimmed, 'Product name');
  if (!localized || Array.isArray(localized)) throw new Error('Subscription product name is invalid');
  for (const key of ['en-US', 'en']) {
    const candidate = localized[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  const fallback = Object.entries(localized)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, candidate]) => candidate)
    .find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (typeof fallback !== 'string') throw new Error('Subscription product name is invalid');
  return fallback.trim();
}

async function findContext(
  database: D1Database,
  stripeSubscriptionId: string,
): Promise<InvoiceSubscriptionContextRow> {
  const rows = await database.prepare(`
SELECT cs.id AS subscription_id,
       cs.stripe_subscription_id,
       cs.stripe_customer_id,
       cs.customer_id,
       cs.acquisition_id,
       cs.plan_id,
       a.product_id,
       a.variant_id,
       a.currency_code,
       a.unit_amount_minor,
       a.stripe_price_id,
       a.cadence_unit,
       a.cadence_count,
       cs.quantity,
       cs.shipping_address,
       c.person AS customer_person,
       c.company AS customer_company,
       c.contacts AS customer_contacts,
       p.name AS product_name,
       v.sku,
       cs.shipping_required
FROM customer_subscriptions cs
JOIN subscription_acquisitions a
  ON a.id = cs.acquisition_id
 AND a.plan_id = cs.plan_id
 AND a.customer_id = cs.customer_id
 AND a.stripe_customer_id = cs.stripe_customer_id
 AND a.stripe_subscription_id = cs.stripe_subscription_id
JOIN customers c ON c.id = cs.customer_id
JOIN products p ON p.id = a.product_id
JOIN product_variants v ON v.id = a.variant_id AND v.product_id = a.product_id
WHERE cs.stripe_subscription_id = ?
LIMIT 2
`).bind(stripeSubscriptionId).all<InvoiceSubscriptionContextRow>();
  if (rows.results.length !== 1) {
    throw new Error(
      rows.results.length === 0
        ? 'Subscription invoice arrived before its lifecycle binding'
        : 'Stripe subscription is bound to multiple local subscriptions',
    );
  }
  return rows.results[0]!;
}

function deterministicOrderId(stripeInvoiceId: string): string {
  return `SUB-${stripeInvoiceId}`;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function customerIdentity(context: InvoiceSubscriptionContextRow): {
  email: string;
  name?: string;
} {
  const person = parseJson<Record<string, unknown>>(context.customer_person, 'Customer person');
  const company = parseJson<Record<string, unknown>>(context.customer_company, 'Customer company');
  const contacts = parseJson<Array<Record<string, unknown>>>(
    context.customer_contacts,
    'Customer contacts',
  );
  const primary = Array.isArray(contacts)
    ? contacts.find((entry) => entry?.is_primary === true) ?? contacts[0]
    : undefined;
  const email = boundedText(person?.email, 320) ?? boundedText(primary?.email, 320);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Subscription customer has no verified delivery email');
  }
  const personParts = [boundedText(person?.first_name, 100), boundedText(person?.last_name, 100)]
    .filter((part): part is string => Boolean(part)).join(' ');
  const name = boundedText(person?.full_name, 200)
    ?? (personParts || undefined)
    ?? boundedText(company?.display_name, 200)
    ?? boundedText(company?.name, 200);
  return { email: email.toLowerCase(), ...(name ? { name } : {}) };
}

function createPendingOrder(
  context: InvoiceSubscriptionContextRow,
  invoice: VerifiedSubscriptionInvoice,
  now: Date,
): Order {
  const unitPrice = Money.fromMinor(context.unit_amount_minor, context.currency_code);
  const lineTotal = unitPrice.times(context.quantity);
  if (!invoice.paidAmount.equals(lineTotal)) {
    throw new Error('Verified subscription invoice total conflicts with its reserved plan');
  }
  const shippingAddress = parseJson<Address>(
    context.shipping_address,
    'Subscription shipping address',
  );
  if (context.shipping_required !== 0 && !shippingAddress) {
    throw new Error('Physical subscription renewal has no durable shipping address');
  }
  if (shippingAddress) assertShippingAddress(shippingAddress);
  const identity = customerIdentity(context);
  const orderId = deterministicOrderId(invoice.stripeInvoiceId);
  const item: OrderItem = {
    id: `${orderId}:line:1`,
    product_id: context.product_id,
    variant_id: context.variant_id,
    sku: context.sku,
    quantity: context.quantity,
    unit_price: unitPrice.toJSON(),
    total_price: lineTotal.toJSON(),
    product_name: productName(context.product_name),
  };
  return {
    id: orderId,
    customer_id: context.customer_id,
    status: 'pending',
    payment_status: 'pending',
    total_amount: invoice.paidAmount.toJSON(),
    currency_code: invoice.paidAmount.currency,
    ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
    items: [item],
    payment_method: 'stripe_subscription_invoice',
    external_references: {
      stripe_invoice_id: invoice.stripeInvoiceId,
      stripe_subscription_id: context.stripe_subscription_id,
      ...(invoice.stripePaymentIntentId
        ? { payment_intent_id: invoice.stripePaymentIntentId }
        : {}),
    },
    extensions: {
      email: identity.email,
      ...(identity.name ? { customer_name: identity.name } : {}),
      [SUBSCRIPTION_ACQUISITION_EXTENSION]: context.acquisition_id,
      subscription_shipping_required: context.shipping_required !== 0,
      subscription_id: context.subscription_id,
      subscription_plan_id: context.plan_id,
      subscription_cadence: {
        unit: context.cadence_unit,
        count: context.cadence_count,
      },
      subscription_period: {
        ...(invoice.periodStart !== undefined ? { start: invoice.periodStart } : {}),
        ...(invoice.periodEnd !== undefined ? { end: invoice.periodEnd } : {}),
      },
      verified_paid_at: invoice.verifiedPaidAt,
      checkout_subtotal: lineTotal.toJSON(),
      checkout_catalog_subtotal: lineTotal.toJSON(),
    },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function orderInsert(database: D1Database, order: Order): D1PreparedStatement {
  return database.prepare(`
INSERT INTO orders (
  id, customer_id, status, total_amount, currency_code, shipping_address,
  items, payment_method, payment_status, external_references, extensions,
  created_at, updated_at
) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
`).bind(
    order.id!,
    order.customer_id ?? null,
    JSON.stringify(order.total_amount),
    order.currency_code,
    order.shipping_address ? JSON.stringify(order.shipping_address) : null,
    JSON.stringify(order.items),
    order.payment_method ?? null,
    JSON.stringify(order.external_references ?? {}),
    JSON.stringify(order.extensions ?? {}),
    order.created_at!,
    order.updated_at!,
  );
}

function invoiceOrderInsert(
  database: D1Database,
  context: InvoiceSubscriptionContextRow,
  invoice: VerifiedSubscriptionInvoice,
  orderId: string,
): D1PreparedStatement {
  return database.prepare(`
INSERT INTO subscription_invoice_orders (
  stripe_invoice_id, subscription_id, order_id, stripe_payment_intent_id,
  paid_amount_minor, currency_code, period_start, period_end, verified_paid_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
    invoice.stripeInvoiceId,
    context.subscription_id,
    orderId,
    invoice.stripePaymentIntentId ?? null,
    invoice.paidAmount.toMinorUnits(),
    invoice.paidAmount.currency,
    invoice.periodStart ?? null,
    invoice.periodEnd ?? null,
    invoice.verifiedPaidAt,
  );
}

function paidPromotion(
  database: D1Database,
  orderId: string,
  invoiceId: string,
  subscriptionId: string,
  now: Date,
): D1PreparedStatement {
  return database.prepare(`
UPDATE orders
SET status = 'processing', payment_status = 'paid', updated_at = ?
WHERE id = ?
  AND status = 'pending'
  AND payment_status = 'pending'
  AND EXISTS (
    SELECT 1 FROM subscription_invoice_orders sio
    WHERE sio.stripe_invoice_id = ?
      AND sio.subscription_id = ?
      AND sio.order_id = orders.id
  )
`).bind(now.toISOString(), orderId, invoiceId, subscriptionId);
}

async function findExistingInvoiceOrder(
  database: D1Database,
  invoiceId: string,
): Promise<ExistingInvoiceOrderRow | null> {
  return database.prepare(`
SELECT sio.stripe_invoice_id, sio.subscription_id, sio.order_id,
       sio.stripe_payment_intent_id, sio.paid_amount_minor, sio.currency_code,
       sio.period_start, sio.period_end, sio.verified_paid_at,
       o.status, o.payment_status, o.total_amount, o.customer_id, o.payment_method, o.items,
       o.shipping_address, o.external_references, o.extensions,
       o.created_at, o.updated_at
FROM subscription_invoice_orders sio
JOIN orders o ON o.id = sio.order_id
WHERE sio.stripe_invoice_id = ?
`).bind(invoiceId).first<ExistingInvoiceOrderRow>();
}

function sameNullable<T>(left: T | null, right: T | undefined): boolean {
  return left === (right ?? null);
}

function hydrateExisting(row: ExistingInvoiceOrderRow): Order {
  return {
    id: row.order_id,
    customer_id: row.customer_id ?? undefined,
    status: row.status,
    payment_status: row.payment_status,
    total_amount: Money.fromStored(row.total_amount, row.currency_code).toJSON(),
    currency_code: row.currency_code,
    payment_method: row.payment_method ?? undefined,
    items: parseJson<OrderItem[]>(row.items, 'Subscription order items') ?? [],
    ...(parseJson<Address>(row.shipping_address, 'Subscription order shipping address')
      ? { shipping_address: parseJson<Address>(row.shipping_address, 'Subscription order shipping address') }
      : {}),
    external_references: parseJson<Record<string, unknown>>(
      row.external_references,
      'Subscription order external references',
    ),
    extensions: parseJson<Record<string, unknown>>(
      row.extensions,
      'Subscription order extensions',
    ),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function assertExistingBinding(
  row: ExistingInvoiceOrderRow,
  context: InvoiceSubscriptionContextRow,
  invoice: VerifiedSubscriptionInvoice,
  expectedOrder: Order,
): void {
  if (row.subscription_id !== context.subscription_id ||
      row.order_id !== deterministicOrderId(invoice.stripeInvoiceId) ||
      row.stripe_payment_intent_id !== (invoice.stripePaymentIntentId ?? null) ||
      row.paid_amount_minor !== invoice.paidAmount.toMinorUnits() ||
      row.currency_code !== invoice.paidAmount.currency ||
      !sameNullable(row.period_start, invoice.periodStart) ||
      !sameNullable(row.period_end, invoice.periodEnd) ||
      row.verified_paid_at !== invoice.verifiedPaidAt ||
      row.customer_id !== context.customer_id ||
      row.currency_code !== expectedOrder.currency_code ||
      !Money.fromStored(row.total_amount, row.currency_code).equals(invoice.paidAmount) ||
      row.payment_method !== expectedOrder.payment_method ||
      row.created_at !== expectedOrder.created_at ||
      !canonicalJsonEqual(parseJson(row.items, 'Subscription order items'), expectedOrder.items) ||
      !canonicalJsonEqual(
        parseJson(row.shipping_address, 'Subscription order shipping address'),
        expectedOrder.shipping_address,
      ) ||
      !canonicalJsonContains(
        parseJson(row.external_references, 'Subscription order external references'),
        expectedOrder.external_references,
      )) {
    throw new Error('Existing subscription invoice order conflicts with verified provider facts');
  }
  const extensions = parseJson<Record<string, unknown>>(
    row.extensions,
    'Subscription order extensions',
  );
  if (!canonicalJsonContains(extensions, expectedOrder.extensions) ||
      extensions?.[SUBSCRIPTION_ACQUISITION_EXTENSION] !== context.acquisition_id ||
      extensions.subscription_id !== context.subscription_id ||
      extensions.subscription_plan_id !== context.plan_id) {
    throw new Error('Existing subscription invoice order has invalid protected attribution');
  }
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJson(entry)]),
    );
  }
  return value;
}

function canonicalJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function canonicalJsonContains(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') {
    return canonicalJsonEqual(actual, expected);
  }
  if (Array.isArray(expected)) return canonicalJsonEqual(actual, expected);
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.entries(expected as Record<string, unknown>).every(
    ([key, value]) => canonicalJsonContains((actual as Record<string, unknown>)[key], value),
  );
}

async function recoverOrReturnExisting(
  database: D1Database,
  context: InvoiceSubscriptionContextRow,
  invoice: VerifiedSubscriptionInvoice,
  pendingOrder: Order,
  now: Date,
): Promise<FulfillSubscriptionInvoiceResult | null> {
  const existing = await findExistingInvoiceOrder(database, invoice.stripeInvoiceId);
  if (!existing) return null;
  assertExistingBinding(existing, context, invoice, pendingOrder);
  const advancedPaidOrder = existing.payment_status === 'paid'
    && ['processing', 'shipped', 'delivered'].includes(existing.status);
  const settledRefundOrder = existing.payment_status === 'refunded'
    && ['refunded', 'cancelled'].includes(existing.status);
  if (advancedPaidOrder || settledRefundOrder) {
    return { order: hydrateExisting(existing), created: false };
  }
  if (existing.payment_status !== 'pending' || existing.status !== 'pending') {
    throw new Error('Existing subscription invoice order is not recoverable');
  }
  const statements = [
    ...preparePaidOrderEffectStatements(database, pendingOrder, {
      now,
      includeSubscription: false,
      includeGiftCard: false,
    }),
    paidPromotion(
      database,
      existing.order_id,
      invoice.stripeInvoiceId,
      context.subscription_id,
      now,
    ),
  ];
  const results = await database.batch(statements);
  if (results.at(-1)?.meta.changes !== 1) {
    const winner = await findExistingInvoiceOrder(database, invoice.stripeInvoiceId);
    if (!winner || winner.payment_status !== 'paid' || winner.status !== 'processing') {
      throw new Error('Subscription invoice order recovery lost its paid promotion');
    }
    assertExistingBinding(winner, context, invoice, pendingOrder);
    return { order: hydrateExisting(winner), created: false };
  }
  const paid = await findExistingInvoiceOrder(database, invoice.stripeInvoiceId);
  if (!paid) throw new Error('Recovered subscription invoice order disappeared');
  return { order: hydrateExisting(paid), created: false };
}

export async function fulfillSubscriptionInvoice(
  args: FulfillSubscriptionInvoiceArgs,
): Promise<FulfillSubscriptionInvoiceResult> {
  assertProviderId(args.stripeInvoiceId, 'in_', 'Stripe invoice id');
  assertProviderId(args.stripeSubscriptionId, 'sub_', 'Stripe subscription id');
  const context = await findContext(args.database, args.stripeSubscriptionId);
  const unitPrice = Money.fromMinor(context.unit_amount_minor, context.currency_code);
  const invoice = await args.provider.retrieveVerifiedInvoice({
    stripeInvoiceId: args.stripeInvoiceId,
    expectedSubscriptionId: context.stripe_subscription_id,
    expectedStripeCustomerId: context.stripe_customer_id,
    expectedStripePriceId: context.stripe_price_id,
    expectedUnitPrice: unitPrice,
    expectedQuantity: context.quantity,
  });
  assertVerifiedSubscriptionInvoice(invoice);
  if (invoice.stripeInvoiceId !== args.stripeInvoiceId) {
    throw new Error('Provider returned a different subscription invoice');
  }
  const now = new Date(invoice.verifiedPaidAt * 1_000);
  const pendingOrder = createPendingOrder(context, invoice, now);
  const existing = await recoverOrReturnExisting(
    args.database,
    context,
    invoice,
    pendingOrder,
    now,
  );
  if (existing) return existing;

  const statements = [
    orderInsert(args.database, pendingOrder),
    invoiceOrderInsert(args.database, context, invoice, pendingOrder.id!),
    ...preparePaidOrderEffectStatements(args.database, pendingOrder, {
      now,
      includeSubscription: false,
      includeGiftCard: false,
    }),
    paidPromotion(
      args.database,
      pendingOrder.id!,
      invoice.stripeInvoiceId,
      context.subscription_id,
      now,
    ),
  ];
  try {
    const results = await args.database.batch(statements);
    if (results.at(-1)?.meta.changes !== 1) {
      throw new Error('Subscription invoice order was not promoted after effect staging');
    }
  } catch (error) {
    const winner = await recoverOrReturnExisting(
      args.database,
      context,
      invoice,
      pendingOrder,
      now,
    );
    if (winner) return winner;
    throw error;
  }
  const paid = await findExistingInvoiceOrder(args.database, invoice.stripeInvoiceId);
  if (!paid) throw new Error('Subscription invoice order commit could not be observed');
  assertExistingBinding(paid, context, invoice, pendingOrder);
  return { order: hydrateExisting(paid), created: true };
}

function assertSubscriptionInvoiceEventInput(args: {
  subscriptionId: string;
  providerEvent: SubscriptionInvoiceEventCursor;
  stripeInvoiceId: string;
}): void {
  if (!/^[^\s]{1,128}$/.test(args.subscriptionId)
    || !/^[^\s]{1,255}$/.test(args.providerEvent.id)
    || !Number.isSafeInteger(args.providerEvent.createdAt)
    || args.providerEvent.createdAt < 0) {
    throw new TypeError('Subscription invoice event identity is invalid');
  }
  assertProviderId(args.stripeInvoiceId, 'in_', 'Stripe invoice id');
}

async function subscriptionInvoiceAuditId(
  identity: string,
  eventType: 'payment_failed' | 'payment_recovered',
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${identity}\u0000${eventType}`),
  );
  return `se_${Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')}`;
}

interface StoredInvoiceEventDecision {
  subscription_id: string;
  provider_event_id: string;
  provider_event_created_at: number;
  event_type: string;
  outcome: string;
  stripe_invoice_id: string | null;
  paid: number;
}

async function findStoredInvoiceEventDecision(
  database: D1Database,
  auditId: string,
  stripeInvoiceId: string,
): Promise<StoredInvoiceEventDecision | null> {
  return database.prepare(`SELECT se.subscription_id, se.provider_event_id,
    se.provider_event_created_at, se.event_type, se.outcome,
    json_extract(se.details, '$.stripe_invoice_id') AS stripe_invoice_id,
    EXISTS (
      SELECT 1 FROM subscription_invoice_orders sio
      WHERE sio.stripe_invoice_id = ? AND sio.subscription_id = se.subscription_id
    ) AS paid
    FROM subscription_events se WHERE se.id = ? LIMIT 1`)
    .bind(stripeInvoiceId, auditId).first<StoredInvoiceEventDecision>();
}

/**
 * Atomically orders a signed payment failure against the paid invoice map.
 * The INSERT statement's SQLite snapshot decides applied versus stale while
 * holding write serialization; duplicate retries notify only while unpaid.
 */
export async function recordSubscriptionInvoiceFailure(args: {
  database: D1Database;
  subscriptionId: string;
  providerEvent: SubscriptionInvoiceEventCursor;
  stripeInvoiceId: string;
}): Promise<SubscriptionInvoiceFailureDecision> {
  assertSubscriptionInvoiceEventInput(args);
  const auditId = await subscriptionInvoiceAuditId(args.providerEvent.id, 'payment_failed');
  const details = JSON.stringify({ stripe_invoice_id: args.stripeInvoiceId });
  const inserted = await args.database.prepare(`INSERT OR IGNORE INTO subscription_events
    (id, subscription_id, provider_event_id, provider_event_created_at,
     event_type, outcome, details)
    SELECT ?, ?, ?, ?, 'payment_failed',
      CASE WHEN EXISTS (
        SELECT 1 FROM subscription_invoice_orders
        WHERE stripe_invoice_id = ? AND subscription_id = ?
      ) THEN 'ignored_stale' ELSE 'applied' END,
      ?
    RETURNING outcome`)
    .bind(
      auditId,
      args.subscriptionId,
      args.providerEvent.id,
      args.providerEvent.createdAt,
      args.stripeInvoiceId,
      args.subscriptionId,
      details,
    ).first<{ outcome: 'applied' | 'ignored_stale' }>();
  if (inserted) {
    return { outcome: inserted.outcome, notify: inserted.outcome === 'applied' };
  }
  const stored = await findStoredInvoiceEventDecision(
    args.database,
    auditId,
    args.stripeInvoiceId,
  );
  if (!stored
    || stored.subscription_id !== args.subscriptionId
    || stored.provider_event_id !== args.providerEvent.id
    || stored.provider_event_created_at !== args.providerEvent.createdAt
    || stored.event_type !== 'payment_failed'
    || stored.stripe_invoice_id !== args.stripeInvoiceId
    || !['applied', 'ignored_stale'].includes(stored.outcome)) {
    throw new Error('Existing subscription payment failure audit conflicts with signed facts');
  }
  const notify = stored.outcome === 'applied' && stored.paid !== 1;
  return {
    outcome: stored.outcome === 'ignored_stale' ? 'ignored_stale' : 'duplicate',
    notify,
  };
}

/**
 * Records at most one recovery per invoice business identity across provider
 * alias event IDs. Absence of either paid map or applied failure is not a
 * recovery and leaves ordinary renewal classification to the caller.
 */
export async function recordSubscriptionInvoiceRecovery(args: {
  database: D1Database;
  subscriptionId: string;
  providerEvent: SubscriptionInvoiceEventCursor;
  stripeInvoiceId: string;
}): Promise<SubscriptionInvoiceRecoveryDecision> {
  assertSubscriptionInvoiceEventInput(args);
  const auditId = await subscriptionInvoiceAuditId(args.stripeInvoiceId, 'payment_recovered');
  const details = JSON.stringify({ stripe_invoice_id: args.stripeInvoiceId });
  const inserted = await args.database.prepare(`INSERT OR IGNORE INTO subscription_events
    (id, subscription_id, provider_event_id, provider_event_created_at,
     event_type, outcome, details)
    SELECT ?, ?, ?, ?, 'payment_recovered', 'applied', ?
    WHERE EXISTS (
      SELECT 1 FROM subscription_invoice_orders
      WHERE stripe_invoice_id = ? AND subscription_id = ?
    ) AND EXISTS (
      SELECT 1 FROM subscription_events
      WHERE subscription_id = ? AND event_type = 'payment_failed'
        AND outcome = 'applied'
        AND json_valid(COALESCE(details, '{}')) = 1
        AND json_extract(details, '$.stripe_invoice_id') = ?
    )
    RETURNING outcome`)
    .bind(
      auditId,
      args.subscriptionId,
      args.providerEvent.id,
      args.providerEvent.createdAt,
      details,
      args.stripeInvoiceId,
      args.subscriptionId,
      args.subscriptionId,
      args.stripeInvoiceId,
    ).first<{ outcome: 'applied' }>();
  if (inserted) return { recovered: true, outcome: 'applied' };
  const stored = await findStoredInvoiceEventDecision(
    args.database,
    auditId,
    args.stripeInvoiceId,
  );
  if (!stored) return { recovered: false };
  if (stored.subscription_id !== args.subscriptionId
    || stored.event_type !== 'payment_recovered'
    || stored.outcome !== 'applied'
    || stored.stripe_invoice_id !== args.stripeInvoiceId) {
    throw new Error('Existing subscription payment recovery audit conflicts with invoice facts');
  }
  return { recovered: true, outcome: 'duplicate' };
}
