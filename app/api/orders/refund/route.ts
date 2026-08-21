import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { authenticateRequest, PERMISSIONS } from '@/lib/auth/unified-auth';
import { getDbAsync } from '@/lib/db';
import { Money } from '@/lib/money';
import { getStripeClient } from '@/lib/stripe';
import { resolveRuntimeCommerceCapabilities } from '@/lib/commerce/runtime';
import { isBoundedArray, isBoundedString, isPlainRecord } from '@/lib/public-request-validation';
import { normalizeRefundLineIds } from '@/lib/payments/refund-idempotency';
import { decideRefundLedgerAction } from '@/lib/payments/refund-ledger';
import {
  mutateRefundLedger,
  parseRefundExtensions,
  type RefundLedgerContext,
  type RefundOrderRow,
} from '@/lib/payments/refund-ledger-store';
import {
  classifyRefundStatus,
  computeRefundedTotal,
  type RefundRecord,
} from '@/lib/utils/refund-validation';
import { allocateRefundTender } from '@/lib/payments/refund-tender';
import type { Order } from '@/lib/types/order';
import { recordTelemetry } from '@/lib/observability/telemetry';

interface RefundRequest {
  orderId: string;
  type: 'full' | 'partial';
  reason: string;
  amount?: number;
  lineIds: string[];
  notes: string;
}

interface Reservation {
  idempotencyKey: string;
  requestFingerprint: string;
  refundAmount: number;
  entryIndex: number;
  cashAmount: number;
  giftAmount: number;
  stripeRefundId?: string;
  requestedAt?: string;
}

interface TenderSnapshot {
  cashPaid: number;
  giftTender: number;
  state?: unknown;
}

const MAX_UNRESOLVED_CREATE_RETRY_MS = 23 * 60 * 60 * 1000;

function parseRequest(value: unknown): RefundRequest | null {
  if (!isPlainRecord(value)) return null;
  if (!isBoundedString(value.orderId, 128) ||
      (value.type !== 'full' && value.type !== 'partial') ||
      !isBoundedString(value.reason, 256) ||
      (value.notes !== undefined && !isBoundedString(value.notes, 1_000, { allowEmpty: true }))) {
    return null;
  }
  const rawItems = value.items ?? [];
  if (!isBoundedArray(rawItems, 100) ||
      !rawItems.every((item) => isBoundedString(item, 128))) {
    return null;
  }
  let lineIds: string[];
  try {
    lineIds = normalizeRefundLineIds(rawItems as string[]);
  } catch {
    return null;
  }
  if (value.type === 'partial') {
    if (!Number.isSafeInteger(value.amount) || Number(value.amount) <= 0 || lineIds.length === 0) {
      return null;
    }
  } else if (value.amount !== undefined || lineIds.length > 0) {
    return null;
  }
  return {
    orderId: value.orderId,
    type: value.type,
    reason: value.reason.trim(),
    ...(value.type === 'partial' ? { amount: Number(value.amount) } : {}),
    lineIds,
    notes: typeof value.notes === 'string' ? value.notes : '',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return parseRefundExtensions(value) ?? {};
}

function orderLineIds(context: RefundLedgerContext): string[] | null {
  const rawItems = context.order.items;
  const items = Array.isArray(rawItems) ? rawItems : [];
  const ids: string[] = [];
  for (const raw of items) {
    if (!isPlainRecord(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id
      ? raw.id
      : `${String(raw.product_id ?? '')}-${String(raw.variant_id ?? 'default')}`;
    if (!id || id.length > 128 || ids.includes(id)) return null;
    ids.push(id);
  }
  return ids;
}

function nonnegativeMinor(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Read only server-written checkout tender state; bearer codes are never retained here. */
function tenderSnapshot(context: RefundLedgerContext, totalAmount: number): TenderSnapshot | null {
  try {
    const tender = Money.fromStored(context.extensions.checkout_tender ?? 0, context.order.currency_code)
      .toMinorUnits();
    if (!Number.isSafeInteger(tender) || tender < 0 || tender > totalAmount) return null;
    if (tender > 0 && context.extensions.checkout_tender_state === undefined) return null;
    return {
      cashPaid: totalAmount - tender,
      giftTender: tender,
      ...(tender > 0 ? { state: context.extensions.checkout_tender_state } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Every active (including pending) refund consumes its planned allocation.
 * That makes a concurrent retry unable to over-allocate either original tender.
 */
function priorTenderAllocation(refunds: RefundRecord[], giftTender: number): {
  refundedCash: number;
  restoredGift: number;
} | null {
  let refundedCash = 0;
  let restoredGift = 0;
  for (const record of refunds) {
    if (classifyRefundStatus(record.status) === 'released') continue;
    const refundAmount = nonnegativeMinor(record.amount);
    if (refundAmount === null || refundAmount === 0) return null;
    const cashAmount = record.cash_amount === undefined
      ? (giftTender === 0 ? refundAmount : null)
      : nonnegativeMinor(record.cash_amount);
    const giftAmount = record.gift_amount === undefined
      ? (giftTender === 0 ? 0 : null)
      : nonnegativeMinor(record.gift_amount);
    if (cashAmount === null || giftAmount === null || cashAmount + giftAmount !== refundAmount) return null;
    if (refundedCash > Number.MAX_SAFE_INTEGER - cashAmount ||
        restoredGift > Number.MAX_SAFE_INTEGER - giftAmount) return null;
    refundedCash += cashAmount;
    restoredGift += giftAmount;
  }
  return { refundedCash, restoredGift };
}

function recordTenderAllocation(record: RefundRecord, giftTender: number): {
  cashAmount: number;
  giftAmount: number;
} | null {
  const refundAmount = nonnegativeMinor(record.amount);
  if (refundAmount === null || refundAmount === 0) return null;
  const cashAmount = record.cash_amount === undefined
    ? (giftTender === 0 ? refundAmount : null)
    : nonnegativeMinor(record.cash_amount);
  const giftAmount = record.gift_amount === undefined
    ? (giftTender === 0 ? 0 : null)
    : nonnegativeMinor(record.gift_amount);
  return cashAmount === null || giftAmount === null || cashAmount + giftAmount !== refundAmount
    ? null
    : { cashAmount, giftAmount };
}

function responseForStoreFailure(reason: string) {
  if (reason === 'not_found') {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (reason === 'invalid_ledger') {
    return NextResponse.json({ error: 'Order refund history requires reconciliation' }, { status: 409 });
  }
  return NextResponse.json({ error: 'Refund reservation conflicted; retry the request' }, { status: 503 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
  if (!authResult.success) {
    return authResult.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }
  const input = parseRequest(body);
  if (!input) {
    recordTelemetry('refund.request_rejected', {
      operation: 'validate', outcome: 'rejected', http_status: 400,
      path: '/api/orders/refund', trigger: 'request',
    });
    return NextResponse.json({ error: 'Invalid refund request' }, { status: 400 });
  }

  const db = await getDbAsync();
  const actor = typeof authResult.tokenInfo?.tokenName === 'string'
    ? authResult.tokenInfo.tokenName.slice(0, 128)
    : 'authenticated-admin';
  const state: {
    reservation?: Reservation;
    completed?: {
      refundAmount: number;
      refundId: string;
      providerStatus: string;
    };
    rejection?: { status: number; error: string };
    bindingError?: string;
  } = {};

  const reserved = await mutateRefundLedger(db, input.orderId, async (context) => {
    delete state.reservation;
    delete state.completed;
    delete state.rejection;
    delete state.bindingError;
    const lineIds = orderLineIds(context);
    if (input.type === 'partial' &&
        (!lineIds || input.lineIds.some((lineId) => !lineIds.includes(lineId)))) {
      state.rejection = { status: 400, error: 'Refund contains an unknown or ambiguous order line' };
      return { action: 'skip' };
    }
    let totalAmount: number;
    try {
      totalAmount = Money.fromStored(
        context.order.total_amount,
        context.order.currency_code
      ).toMinorUnits();
    } catch {
      state.rejection = { status: 409, error: 'Order total is invalid' };
      return { action: 'skip' };
    }
    const tender = tenderSnapshot(context, totalAmount);
    if (!tender) {
      state.rejection = { status: 409, error: 'Order tender snapshot is invalid' };
      return { action: 'skip' };
    }
    const hasStripeRefundedFloor = Object.prototype.hasOwnProperty.call(
      context.extensions,
      'stripe_amount_refunded'
    );
    const rawStripeRefundedFloor = context.extensions.stripe_amount_refunded;
    if (hasStripeRefundedFloor &&
        (typeof rawStripeRefundedFloor !== 'number' ||
          !Number.isSafeInteger(rawStripeRefundedFloor) ||
          rawStripeRefundedFloor < 0)) {
      state.rejection = { status: 409, error: 'Recorded Stripe refund total is invalid' };
      return { action: 'skip' };
    }

    const decision = await decideRefundLedgerAction(context.refunds, {
      orderId: input.orderId,
      type: input.type,
      amount: input.amount,
      lineIds: input.lineIds,
      totalAmount,
      stripeRefundedFloor: hasStripeRefundedFloor
        ? rawStripeRefundedFloor as number
        : undefined,
    });
    if (decision.action === 'reject') {
      state.rejection = { status: decision.status, error: decision.error };
      return { action: 'skip' };
    }
    if (decision.action === 'completed') {
      state.completed = {
        refundAmount: decision.refundAmount,
        refundId: decision.stripeRefundId ?? decision.idempotencyKey,
        providerStatus: decision.providerStatus,
      };
      return { action: 'skip' };
    }
    if (decision.action === 'reconcile') {
      const allocation = recordTenderAllocation(context.refunds[decision.entryIndex], tender.giftTender);
      if (!allocation) {
        state.rejection = { status: 409, error: 'Refund tender allocation requires reconciliation' };
        return { action: 'skip' };
      }
      state.reservation = {
        idempotencyKey: decision.idempotencyKey,
        requestFingerprint: decision.requestFingerprint,
        refundAmount: decision.refundAmount,
        entryIndex: decision.entryIndex,
        ...allocation,
        ...(decision.stripeRefundId ? { stripeRefundId: decision.stripeRefundId } : {}),
        ...(decision.requestedAt ? { requestedAt: decision.requestedAt } : {}),
      };
      return { action: 'skip' };
    }
    if (context.order.payment_status !== 'paid') {
      state.rejection = { status: 409, error: 'Only paid orders can be refunded' };
      return { action: 'skip' };
    }

    const prior = priorTenderAllocation(context.refunds, tender.giftTender);
    if (!prior) {
      state.rejection = { status: 409, error: 'Refund tender allocation requires reconciliation' };
      return { action: 'skip' };
    }
    let allocation: { cashAmount: number; giftAmount: number };
    try {
      allocation = allocateRefundTender({
        refundAmount: decision.refundAmount,
        cashPaid: tender.cashPaid,
        giftTender: tender.giftTender,
        refundedCash: prior.refundedCash,
        restoredGift: prior.restoredGift,
      });
    } catch {
      state.rejection = { status: 409, error: 'Refund exceeds original tender allocation' };
      return { action: 'skip' };
    }
    if (allocation.cashAmount > 0) {
      const external = asRecord(context.order.external_references);
      const extensionPaymentIntent = context.extensions.payment_intent_id;
      const externalPaymentIntent = external.payment_intent_id;
      if (typeof extensionPaymentIntent !== 'string' ||
          typeof externalPaymentIntent !== 'string' ||
          extensionPaymentIntent !== externalPaymentIntent) {
        state.bindingError = 'Order PaymentIntent binding is missing or inconsistent';
        return { action: 'skip' };
      }
    }

    const entry: RefundRecord = {
      id: decision.idempotencyKey,
      idempotency_key: decision.idempotencyKey,
      request_fingerprint: decision.requestFingerprint,
      amount: decision.refundAmount,
      type: input.type,
      items: input.lineIds,
      reason: input.reason,
      notes: input.notes,
      status: 'pending',
      settled_sequence: decision.settledSequence,
      requested_at: context.nowIso,
      requested_by: actor,
      cash_amount: allocation.cashAmount,
      gift_amount: allocation.giftAmount,
      ...(allocation.giftAmount > 0 ? { gift_restoration_status: 'pending' } : {}),
    };
    const refunds = [...context.refunds, entry];
    state.reservation = {
      idempotencyKey: decision.idempotencyKey,
      requestFingerprint: decision.requestFingerprint,
      refundAmount: decision.refundAmount,
      entryIndex: refunds.length - 1,
      ...allocation,
    };
    return {
      action: 'write',
      extensions: {
        ...context.extensions,
        refunds,
        refunds_version: context.nextVersion,
      },
    };
  });

  if (!reserved.ok) return responseForStoreFailure(reserved.reason);
  if (state.bindingError) return NextResponse.json({ error: state.bindingError }, { status: 409 });
  if (state.rejection) {
    return NextResponse.json({ error: state.rejection.error }, { status: state.rejection.status });
  }
  if (state.completed) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      refund: {
        id: state.completed.refundId,
        amount: state.completed.refundAmount,
        type: input.type,
        reason: input.reason,
        items: input.lineIds,
        status: 'succeeded',
        providerStatus: state.completed.providerStatus,
      },
      order: {
        id: input.orderId,
        status: reserved.order.status,
        payment_status: reserved.order.payment_status,
      },
    });
  }
  const reservation = state.reservation;
  if (!reservation) {
    return NextResponse.json({ error: 'Refund reservation could not be established' }, { status: 503 });
  }

  const paymentIntentId = asRecord(reserved.order.external_references).payment_intent_id;
  if (reservation.cashAmount > 0 && typeof paymentIntentId !== 'string') {
    return NextResponse.json({ error: 'Order PaymentIntent binding is missing or inconsistent' }, { status: 409 });
  }

  /** Persist provider and restoration progress before performing the next durable leg. */
  const persist = async (args: {
    status: 'pending' | 'requires_action' | 'succeeded' | 'failed';
    providerStatus: string;
    stripeRefundId?: string;
    giftRestorationStatus?: 'pending' | 'succeeded';
  }): Promise<{ kind: 'response'; response: NextResponse } | { kind: 'order'; order: RefundOrderRow }> => {
    let conflict = false;
    try {
      const result = await mutateRefundLedger(db, input.orderId, (context) => {
        conflict = false;
        const entryIndex = context.refunds.findIndex(
          (entry) => entry.idempotency_key === reservation.idempotencyKey
        );
        if (entryIndex < 0) {
          conflict = true;
          return { action: 'skip' };
        }
        const current = context.refunds[entryIndex];
        const allocation = recordTenderAllocation(current, reservation.giftAmount > 0 ? reservation.giftAmount : 0);
        if (!allocation || allocation.cashAmount !== reservation.cashAmount || allocation.giftAmount !== reservation.giftAmount) {
          conflict = true;
          return { action: 'skip' };
        }
        if (current.status === 'succeeded' && args.status === 'succeeded') return { action: 'skip' };
        const refunds = context.refunds.slice();
        refunds[entryIndex] = {
          ...current,
          status: args.status,
          provider_status: args.providerStatus,
          ...(args.stripeRefundId ? { stripe_refund_id: args.stripeRefundId } : {}),
          ...(args.giftRestorationStatus ? { gift_restoration_status: args.giftRestorationStatus } : {}),
          processed_at: context.nowIso,
        };
        const extensions = { ...context.extensions, refunds, refunds_version: context.nextVersion };
        const total = Money.fromStored(context.order.total_amount, context.order.currency_code).toMinorUnits();
        const fullySettled = args.status === 'succeeded' && computeRefundedTotal({ refunds }) === total;
        return {
          action: 'write', extensions,
          ...(fullySettled ? { columns: { status: 'cancelled' as const, payment_status: 'refunded' as const } } : {}),
        };
      });
      if (!result.ok) {
        recordTelemetry('refund.settlement_failed', {
          operation: 'persist', outcome: result.reason === 'cas_exhausted' ? 'conflict' : 'failed',
          provider: 'd1', retryable: result.reason === 'cas_exhausted',
          path: '/api/orders/refund', trigger: 'request',
        });
        return { kind: 'response', response: responseForStoreFailure(result.reason) };
      }
      if (conflict) {
        recordTelemetry('refund.settlement_failed', {
          operation: 'persist', outcome: 'conflict', provider: 'd1', retryable: true,
          path: '/api/orders/refund', trigger: 'request',
        });
        return { kind: 'response', response: NextResponse.json(
          { error: 'Refund was accepted but ledger reconciliation is pending' },
          { status: 503, headers: { 'Retry-After': '5' } }
        ) };
      }
      return { kind: 'order', order: result.order };
    } catch (error) {
      recordTelemetry('refund.settlement_failed', {
        operation: 'persist', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/orders/refund', trigger: 'request',
      }, error);
      throw error;
    }
  };

  let providerStatus = 'not_applicable';
  let stripeRefundId: string | undefined;
  let normalizedStatus: 'pending' | 'requires_action' | 'succeeded' | 'failed' = 'succeeded';
  if (reservation.cashAmount > 0) {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId as string,
      amount: reservation.cashAmount,
      reason: 'requested_by_customer',
      metadata: {
        orderId: input.orderId, refundType: input.type, refundReason: input.reason,
        lineCount: String(input.lineIds.length), refundRequestId: reservation.idempotencyKey,
      },
    };
    let stripeRefund: Stripe.Refund;
    const stripe = getStripeClient();
    try {
      if (reservation.stripeRefundId) {
        stripeRefund = await stripe.refunds.retrieve(reservation.stripeRefundId);
      } else {
        const requestedAt = reservation.requestedAt ? new Date(reservation.requestedAt).getTime() : Date.now();
        if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > MAX_UNRESOLVED_CREATE_RETRY_MS) {
          return NextResponse.json({ error: 'Refund requires provider reconciliation before it can be retried' }, { status: 409 });
        }
        stripeRefund = await stripe.refunds.create(refundParams, { idempotencyKey: reservation.idempotencyKey });
      }
    } catch (error) {
      recordTelemetry('refund.provider_unresolved', {
        operation: 'process', outcome: 'unresolved', provider: 'stripe', retryable: true,
        path: '/api/orders/refund', trigger: 'request',
      }, error);
      return NextResponse.json({ error: 'Refund status is unresolved; retry this same request' },
        { status: 503, headers: { 'Retry-After': '5' } });
    }
    const providerPaymentIntent = typeof stripeRefund.payment_intent === 'string'
      ? stripeRefund.payment_intent : stripeRefund.payment_intent?.id;
    if (
      stripeRefund.id.length === 0 ||
      (reservation.stripeRefundId !== undefined && stripeRefund.id !== reservation.stripeRefundId) ||
      providerPaymentIntent !== paymentIntentId ||
      !Number.isSafeInteger(stripeRefund.amount) || stripeRefund.amount !== reservation.cashAmount
    ) {
      recordTelemetry('refund.provider_inconsistent', {
        operation: 'validate', outcome: 'invalid', provider: 'stripe', http_status: 502,
        path: '/api/orders/refund', trigger: 'request',
      });
      return NextResponse.json({ error: 'Payment provider returned an inconsistent refund' }, { status: 502 });
    }
    stripeRefundId = stripeRefund.id;
    providerStatus = stripeRefund.status ?? 'unknown';
    const providerClass = classifyRefundStatus(providerStatus);
    normalizedStatus = providerClass === 'settled' ? 'succeeded'
      : providerClass === 'released' ? 'failed'
        : providerStatus === 'requires_action' ? 'requires_action' : 'pending';
  }

  if (normalizedStatus !== 'succeeded') {
    const outcome = await persist({ status: normalizedStatus, providerStatus, stripeRefundId,
      ...(reservation.giftAmount > 0 ? { giftRestorationStatus: 'pending' as const } : {}) });
    if (outcome.kind === 'response') return outcome.response;
    if (normalizedStatus === 'failed') return NextResponse.json({ error: 'Stripe rejected the refund' }, { status: 502 });
    return NextResponse.json({ success: true, refund: {
      id: stripeRefundId, amount: reservation.refundAmount, type: input.type, reason: input.reason,
      items: input.lineIds, status: normalizedStatus, providerStatus,
    }, order: { id: input.orderId, status: outcome.order.status, payment_status: outcome.order.payment_status } }, { status: 202 });
  }

  if (reservation.giftAmount > 0) {
    // The cash result is durable before restoration. If restoration is interrupted,
    // retries retrieve this exact provider refund and restore with the same opaque key.
    const cashRecorded = await persist({
      status: 'pending', providerStatus, stripeRefundId, giftRestorationStatus: 'pending',
    });
    if (cashRecorded.kind === 'response') return cashRecorded.response;
    try {
      const capabilities = await resolveRuntimeCommerceCapabilities();
      const restoreTender = capabilities.giftCards.restoreTender;
      if (!restoreTender) throw new Error('Gift-card restoration is not configured');
      await restoreTender({
        order: reserved.order as Order,
        state: asRecord(reserved.order.extensions).checkout_tender_state,
        refundKey: reservation.idempotencyKey,
        amount: Money.fromMinor(reservation.giftAmount, reserved.order.currency_code),
      });
    } catch (error) {
      recordTelemetry('refund.gift_restoration_unresolved', {
        operation: 'process', outcome: 'unresolved', provider: 'gift_card', retryable: true,
        path: '/api/orders/refund', trigger: 'request',
      }, error);
      return NextResponse.json({ error: 'Refund cash settlement succeeded; gift restoration is pending' },
        { status: 503, headers: { 'Retry-After': '5' } });
    }
  }

  const completed = await persist({
    status: 'succeeded', providerStatus, stripeRefundId,
    ...(reservation.giftAmount > 0 ? { giftRestorationStatus: 'succeeded' as const } : {}),
  });
  if (completed.kind === 'response') return completed.response;
  return NextResponse.json({
    success: true,
    refund: {
      id: stripeRefundId ?? reservation.idempotencyKey,
      amount: reservation.refundAmount, type: input.type, reason: input.reason,
      items: input.lineIds, status: 'succeeded', providerStatus,
      processed_at: new Date().toISOString(),
    },
    order: { id: input.orderId, status: completed.order.status, payment_status: completed.order.payment_status },
  });
}
