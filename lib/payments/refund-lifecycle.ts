import {
  MAX_REFUND_RECORDS,
  classifyRefundStatus,
  computeRefundedTotal,
  isPositiveSafeInteger,
  type RefundRecord,
} from '@/lib/utils/refund-validation';

export interface ProviderRefundSnapshot {
  id: string;
  amount: number;
  status: string;
  paymentIntentId: string;
  requestId?: string;
  createdAt?: string;
}

export interface RefundLifecycleInput {
  mode: 'charge' | 'lifecycle';
  refunds: RefundRecord[];
  providerRefunds: ProviderRefundSnapshot[];
  targetRefundId?: string;
  chargeAmountRefunded: number;
  totalAmount: number;
  orderLineIds: string[];
  externalRestockEnabled: boolean;
  nowIso: string;
}

export interface RefundLifecycleDecision {
  refunds: RefundRecord[];
  stripeAmountRefunded: number;
  fullyRefunded: boolean;
  restockLineIds: string[];
  settledRefunds: Array<{ id: string; amount: number }>;
  matchedTarget: boolean;
}

function normalizeProviderStatus(status: string): 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' {
  const classification = classifyRefundStatus(status);
  if (classification === 'settled') return 'succeeded';
  if (classification === 'released') return status === 'canceled' ? 'canceled' : 'failed';
  if (classification === 'reserved') return status === 'requires_action' ? 'requires_action' : 'pending';
  throw new Error(`Unsupported Stripe refund status: ${status}`);
}

function validateLineIds(lineIds: string[], name: string): void {
  if (lineIds.length > 100 || new Set(lineIds).size !== lineIds.length ||
      lineIds.some((lineId) => typeof lineId !== 'string' || !lineId || lineId.length > 128)) {
    throw new Error(`${name} contains invalid line ids`);
  }
}

function findLocalEntry(
  refunds: RefundRecord[],
  provider: ProviderRefundSnapshot
): number {
  const matches = refunds.flatMap((entry, index) => {
    const stripeMatch = entry.stripe_refund_id === provider.id;
    const requestMatch = provider.requestId !== undefined &&
      entry.idempotency_key === provider.requestId;
    return stripeMatch || requestMatch ? [index] : [];
  });
  if (matches.length > 1) {
    throw new Error(`Refund ${provider.id} matches multiple local ledger entries`);
  }
  return matches[0] ?? -1;
}

/**
 * Reconcile signed provider truth into the local ledger without performing I/O.
 * Only charge.refunded may append Dashboard-created refunds; lifecycle events
 * may update an existing entry and advance the provider floor, but never append.
 */
export function decideRefundLifecycle(input: RefundLifecycleInput): RefundLifecycleDecision {
  if (!Array.isArray(input.refunds) || input.refunds.length > MAX_REFUND_RECORDS) {
    throw new Error('Refund ledger is invalid or exceeds its supported size');
  }
  if (!isPositiveSafeInteger(input.totalAmount) ||
      !Number.isSafeInteger(input.chargeAmountRefunded) ||
      input.chargeAmountRefunded < 0 ||
      input.chargeAmountRefunded > input.totalAmount) {
    throw new Error('Stripe refund total is invalid for this order');
  }
  validateLineIds(input.orderLineIds, 'Order');
  if (input.mode === 'lifecycle' &&
      (!input.targetRefundId || input.providerRefunds.length !== 1 ||
        input.providerRefunds[0]?.id !== input.targetRefundId)) {
    throw new Error('Lifecycle reconciliation requires exactly its target refund');
  }

  const providerIds = new Set<string>();
  let providerSettledTotal = 0;
  for (const provider of input.providerRefunds) {
    if (!provider.id || provider.id.length > 256 || providerIds.has(provider.id) ||
        !isPositiveSafeInteger(provider.amount) || !provider.paymentIntentId) {
      throw new Error('Stripe returned an invalid or duplicate refund');
    }
    providerIds.add(provider.id);
    if (normalizeProviderStatus(provider.status) === 'succeeded') {
      if (providerSettledTotal > Number.MAX_SAFE_INTEGER - provider.amount) {
        throw new Error('Stripe refund arithmetic overflowed');
      }
      providerSettledTotal += provider.amount;
    }
  }
  if (input.mode === 'charge' && providerSettledTotal !== input.chargeAmountRefunded) {
    throw new Error('Stripe refund list does not match the charge refund total');
  }

  const refunds = input.refunds.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Refund ledger contains an invalid entry');
    }
    return { ...entry };
  });
  let matchedTarget = input.mode === 'charge';
  const settledRefunds: Array<{ id: string; amount: number }> = [];
  const restockCandidates: Array<{ provider: ProviderRefundSnapshot; entry: RefundRecord }> = [];

  for (const provider of input.providerRefunds) {
    const status = normalizeProviderStatus(provider.status);
    let entryIndex = findLocalEntry(refunds, provider);
    if (entryIndex < 0) {
      if (input.mode === 'lifecycle') continue;
      if (refunds.length >= MAX_REFUND_RECORDS) {
        throw new Error('Refund ledger has reached its supported size');
      }
      refunds.push({
        id: `stripe:${provider.id}`,
        stripe_refund_id: provider.id,
        amount: provider.amount,
        type: 'partial',
        items: [],
        status,
        provider_status: provider.status,
        source: 'stripe_dashboard',
        requested_at: provider.createdAt ?? input.nowIso,
        processed_at: input.nowIso,
      });
      entryIndex = refunds.length - 1;
    } else {
      const current = refunds[entryIndex];
      if (!isPositiveSafeInteger(current.amount) || current.amount !== provider.amount) {
        throw new Error(`Stripe refund ${provider.id} amount conflicts with the local ledger`);
      }
      refunds[entryIndex] = {
        ...current,
        stripe_refund_id: provider.id,
        status,
        provider_status: provider.status,
        processed_at: input.nowIso,
      };
    }

    if (provider.id === input.targetRefundId) matchedTarget = true;
    if (status === 'succeeded') {
      settledRefunds.push({ id: provider.id, amount: provider.amount });
      restockCandidates.push({ provider, entry: refunds[entryIndex] });
    }
  }

  const localTotal = computeRefundedTotal({ refunds });
  if (!Number.isSafeInteger(localTotal) || localTotal > input.totalAmount) {
    throw new Error('Reconciled refund ledger exceeds the order total');
  }
  const unsettled = refunds.some((entry) => classifyRefundStatus(entry.status) === 'reserved');
  const fullyRefunded = input.chargeAmountRefunded === input.totalAmount &&
    localTotal === input.totalAmount && !unsettled;

  const knownLines = new Set(input.orderLineIds);
  const restockLineIds = new Set<string>();
  for (const { entry } of restockCandidates) {
    if (entry.source === 'stripe_dashboard') {
      if (input.externalRestockEnabled && fullyRefunded) {
        input.orderLineIds.forEach((lineId) => restockLineIds.add(lineId));
      }
      continue;
    }
    const lineIds = entry.type === 'full' ? input.orderLineIds : entry.items ?? [];
    validateLineIds(lineIds, 'Refund');
    for (const lineId of lineIds) {
      if (!knownLines.has(lineId)) {
        throw new Error('Refund ledger references an unknown order line');
      }
      restockLineIds.add(lineId);
    }
  }

  return {
    refunds,
    stripeAmountRefunded: input.chargeAmountRefunded,
    fullyRefunded,
    restockLineIds: [...restockLineIds].sort(),
    settledRefunds,
    matchedTarget,
  };
}
