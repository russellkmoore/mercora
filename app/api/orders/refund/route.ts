import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { authenticateRequest, PERMISSIONS } from '@/lib/auth/unified-auth';
import { getDbAsync } from '@/lib/db';
import { Money } from '@/lib/money';
import { getStripeClient } from '@/lib/stripe';
import { isBoundedArray, isBoundedString, isPlainRecord } from '@/lib/public-request-validation';
import { normalizeRefundLineIds } from '@/lib/payments/refund-idempotency';
import { decideRefundLedgerAction } from '@/lib/payments/refund-ledger';
import {
  mutateRefundLedger,
  parseRefundExtensions,
  type RefundLedgerContext,
} from '@/lib/payments/refund-ledger-store';
import {
  classifyRefundStatus,
  computeRefundedTotal,
  type RefundRecord,
} from '@/lib/utils/refund-validation';
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
  stripeRefundId?: string;
  requestedAt?: string;
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

function responseForStoreFailure(reason: string) {
  if (reason === 'not_found') {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (reason === 'invalid_ledger') {
    return NextResponse.json({ error: 'Order refund history requires reconciliation' }, { status: 409 });
  }
  return NextResponse.json({ error: 'Refund reservation conflicted; retry the request' }, { status: 503 });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
  if (!authResult.success) return authResult.response!;

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
      stripeRefundId: string;
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
    const external = asRecord(context.order.external_references);
    const extensionPaymentIntent = context.extensions.payment_intent_id;
    const externalPaymentIntent = external.payment_intent_id;
    if (typeof extensionPaymentIntent !== 'string' ||
        typeof externalPaymentIntent !== 'string' ||
        extensionPaymentIntent !== externalPaymentIntent) {
      state.bindingError = 'Order PaymentIntent binding is missing or inconsistent';
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
        stripeRefundId: decision.stripeRefundId,
        providerStatus: decision.providerStatus,
      };
      return { action: 'skip' };
    }
    if (decision.action === 'reconcile') {
      state.reservation = {
        idempotencyKey: decision.idempotencyKey,
        requestFingerprint: decision.requestFingerprint,
        refundAmount: decision.refundAmount,
        entryIndex: decision.entryIndex,
        ...(decision.stripeRefundId ? { stripeRefundId: decision.stripeRefundId } : {}),
        ...(decision.requestedAt ? { requestedAt: decision.requestedAt } : {}),
      };
      return { action: 'skip' };
    }
    if (context.order.payment_status !== 'paid') {
      state.rejection = { status: 409, error: 'Only paid orders can be refunded' };
      return { action: 'skip' };
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
    };
    const refunds = [...context.refunds, entry];
    state.reservation = {
      idempotencyKey: decision.idempotencyKey,
      requestFingerprint: decision.requestFingerprint,
      refundAmount: decision.refundAmount,
      entryIndex: refunds.length - 1,
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
        id: state.completed.stripeRefundId,
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

  const paymentIntentId = asRecord(reserved.order.external_references).payment_intent_id as string;
  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    amount: reservation.refundAmount,
    reason: 'requested_by_customer',
    metadata: {
      orderId: input.orderId,
      refundType: input.type,
      refundReason: input.reason,
      lineCount: String(input.lineIds.length),
      refundRequestId: reservation.idempotencyKey,
    },
  };

  let stripeRefund: Stripe.Refund;
  const stripe = getStripeClient();
  try {
    if (reservation.stripeRefundId) {
      stripeRefund = await stripe.refunds.retrieve(reservation.stripeRefundId);
    } else {
      const requestedAt = reservation.requestedAt
        ? new Date(reservation.requestedAt).getTime()
        : Date.now();
      if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > MAX_UNRESOLVED_CREATE_RETRY_MS) {
        return NextResponse.json(
          { error: 'Refund requires provider reconciliation before it can be retried' },
          { status: 409 }
        );
      }
      stripeRefund = await stripe.refunds.create(
        refundParams,
        { idempotencyKey: reservation.idempotencyKey }
      );
    }
  } catch (error) {
    // A transport error is ambiguous: Stripe may have accepted the request.
    // Keep the exact reservation pending so a retry reuses the same provider key.
    recordTelemetry('refund.provider_unresolved', {
      operation: 'process', outcome: 'unresolved', provider: 'stripe',
      retryable: true, path: '/api/orders/refund', trigger: 'request',
    }, error);
    return NextResponse.json(
      { error: 'Refund status is unresolved; retry this same request' },
      { status: 503, headers: { 'Retry-After': '5' } }
    );
  }

  const providerPaymentIntent = typeof stripeRefund.payment_intent === 'string'
    ? stripeRefund.payment_intent
    : stripeRefund.payment_intent?.id;
  const providerResultIsConsistent =
    stripeRefund.id.length > 0 &&
    (!reservation.stripeRefundId || stripeRefund.id === reservation.stripeRefundId) &&
    providerPaymentIntent === paymentIntentId &&
    Number.isSafeInteger(stripeRefund.amount) &&
    stripeRefund.amount === reservation.refundAmount;
  if (!providerResultIsConsistent) {
    // Keep the reservation pending: an inconsistent response must be reconciled,
    // never released or settled against the wrong order or amount.
    recordTelemetry('refund.provider_inconsistent', {
      operation: 'validate', outcome: 'invalid', provider: 'stripe',
      http_status: 502, path: '/api/orders/refund', trigger: 'request',
    });
    return NextResponse.json(
      { error: 'Payment provider returned an inconsistent refund' },
      { status: 502 }
    );
  }

  const providerStatus = stripeRefund.status ?? 'unknown';
  const providerClass = classifyRefundStatus(providerStatus);
  const normalizedStatus = providerClass === 'settled'
    ? 'succeeded'
    : providerClass === 'released'
      ? 'failed'
      : providerStatus === 'requires_action'
        ? 'requires_action'
        : 'pending';
  let settlementConflict = false;
  const settled = await mutateRefundLedger(db, input.orderId, (context) => {
    settlementConflict = false;
    const entryIndex = context.refunds.findIndex(
      (entry) => entry.idempotency_key === reservation!.idempotencyKey
    );
    if (entryIndex < 0) {
      settlementConflict = true;
      return { action: 'skip' };
    }
    const current = context.refunds[entryIndex];
    if (current.status === 'succeeded' && current.stripe_refund_id === stripeRefund.id) {
      return { action: 'skip' };
    }
    const refunds = context.refunds.slice();
    refunds[entryIndex] = {
      ...current,
      status: normalizedStatus,
      provider_status: providerStatus,
      stripe_refund_id: stripeRefund.id,
      processed_at: context.nowIso,
    };
    const extensions = {
      ...context.extensions,
      refunds,
      refunds_version: context.nextVersion,
    };
    const total = Money.fromStored(
      context.order.total_amount,
      context.order.currency_code
    ).toMinorUnits();
    const fullySettled = normalizedStatus === 'succeeded' &&
      computeRefundedTotal({ refunds }) === total;
    return {
      action: 'write',
      extensions,
      ...(fullySettled ? {
        columns: { status: 'cancelled' as const, payment_status: 'refunded' as const },
      } : {}),
    };
  });
  if (!settled.ok) return responseForStoreFailure(settled.reason);
  if (settlementConflict) {
    recordTelemetry('refund.settlement_failed', {
      operation: 'persist', outcome: 'conflict', provider: 'd1',
      retryable: true, path: '/api/orders/refund', trigger: 'request',
    });
    return NextResponse.json(
      { error: 'Refund was accepted but ledger reconciliation is pending' },
      { status: 503, headers: { 'Retry-After': '5' } }
    );
  }
  if (normalizedStatus === 'failed') {
    return NextResponse.json({ error: 'Stripe rejected the refund' }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    refund: {
      id: stripeRefund.id,
      amount: reservation.refundAmount,
      type: input.type,
      reason: input.reason,
      items: input.lineIds,
      status: normalizedStatus,
      providerStatus,
      processed_at: new Date().toISOString(),
    },
    order: {
      id: input.orderId,
      status: settled.order.status,
      payment_status: settled.order.payment_status,
    },
  }, { status: normalizedStatus === 'succeeded' ? 200 : 202 });
}
