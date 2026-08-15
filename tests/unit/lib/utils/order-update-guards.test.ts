import { describe, expect, it } from 'vitest';
import {
  SERVER_OWNED_ORDER_EXTERNAL_REFERENCE_KEYS,
  SERVER_OWNED_ORDER_EXTENSION_KEYS,
  SERVER_OWNED_SUBSCRIPTION_ORDER_EXTENSION_KEYS,
  mergeOrderExtensions,
  mergeOrderExternalReferences,
  validateOrderMetadataUpdate,
} from '@/lib/utils/order-update-guards';
import { SUBSCRIPTION_ACQUISITION_EXTENSION } from '@/lib/commerce/capabilities';

describe('order update trust boundary', () => {
  it.each(['status', 'payment_status', 'customer_id', 'items', 'total_amount', 'tracking_number'])(
    'rejects the server-owned top-level field %s',
    (field) => {
      expect(validateOrderMetadataUpdate({ orderId: 'WEB-X-1', [field]: 'forged' })).toMatchObject({
        ok: false,
        status: 400,
      });
    }
  );

  it('rejects unknown fields instead of silently writing them', () => {
    expect(validateOrderMetadataUpdate({ orderId: 'WEB-X-1', surprise: true })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('preserves every server-read extension key while merging client metadata', () => {
    const current = Object.fromEntries(
      SERVER_OWNED_ORDER_EXTENSION_KEYS.map((key) => [key, `server:${key}`])
    );
    const incoming = Object.fromEntries(
      SERVER_OWNED_ORDER_EXTENSION_KEYS.map((key) => [key, `client:${key}`])
    );
    incoming.public_note = 'allowed';

    const result = mergeOrderExtensions(incoming, current);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const key of SERVER_OWNED_ORDER_EXTENSION_KEYS) {
      expect(result.value[key]).toBe(`server:${key}`);
    }
    expect(result.value.public_note).toBe('allowed');
  });

  it('pins payment_intent_id in both JSON columns', () => {
    expect(mergeOrderExtensions(
      { payment_intent_id: 'pi_attacker' },
      { payment_intent_id: 'pi_server' }
    )).toEqual({ ok: true, value: { payment_intent_id: 'pi_server' } });
    expect(mergeOrderExternalReferences(
      { payment_intent_id: 'pi_attacker', erp: 'E-1' },
      { payment_intent_id: 'pi_server' }
    )).toEqual({
      ok: true,
      value: { payment_intent_id: 'pi_server', erp: 'E-1' },
    });
  });

  it('cannot plant, replace, or remove the subscription acquisition marker', () => {
    expect(SERVER_OWNED_ORDER_EXTENSION_KEYS).toContain(SUBSCRIPTION_ACQUISITION_EXTENSION);
    expect(mergeOrderExtensions(
      { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_attacker' },
      {},
    )).toEqual({ ok: true, value: {} });
    expect(mergeOrderExtensions(
      { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_attacker' },
      { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_server' },
    )).toEqual({
      ok: true,
      value: { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_server' },
    });
    expect(mergeOrderExtensions(
      {},
      { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_server' },
    )).toEqual({
      ok: true,
      value: { [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_server' },
    });
  });

  it('pins complete subscription invoice attribution without changing replay values', () => {
    const current = {
      [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_server',
      subscription_shipping_required: false,
      subscription_id: 'subscription_server',
      subscription_plan_id: 'plan_server',
      subscription_cadence: { unit: 'month', count: 1 },
      subscription_period: { start: 1_800_000_000, end: 1_802_678_400 },
      verified_paid_at: 1_800_000_001,
    };
    const forged = {
      [SUBSCRIPTION_ACQUISITION_EXTENSION]: 'acq_attacker',
      subscription_shipping_required: true,
      subscription_id: 'subscription_attacker',
      subscription_plan_id: 'plan_attacker',
      subscription_cadence: { unit: 'year', count: 5 },
      subscription_period: { start: 0, end: 1 },
      verified_paid_at: 1,
    };
    const removals = Object.fromEntries(
      SERVER_OWNED_SUBSCRIPTION_ORDER_EXTENSION_KEYS.map((key) => [key, null])
    );

    expect(mergeOrderExtensions(forged, current)).toEqual({ ok: true, value: current });
    expect(mergeOrderExtensions(forged, {})).toEqual({ ok: true, value: {} });
    expect(mergeOrderExtensions(removals, current)).toEqual({ ok: true, value: current });
    expect(mergeOrderExtensions({}, current)).toEqual({ ok: true, value: current });
  });

  it('pins Stripe invoice and subscription references against plant, change, and removal', () => {
    const current = {
      payment_intent_id: 'pi_server',
      stripe_invoice_id: 'in_server',
      stripe_subscription_id: 'sub_server',
    };
    const forged = {
      payment_intent_id: 'pi_attacker',
      stripe_invoice_id: 'in_attacker',
      stripe_subscription_id: 'sub_attacker',
    };
    const removals = Object.fromEntries(
      SERVER_OWNED_ORDER_EXTERNAL_REFERENCE_KEYS.map((key) => [key, null])
    );

    expect(SERVER_OWNED_ORDER_EXTERNAL_REFERENCE_KEYS).toEqual([
      'payment_intent_id',
      'stripe_invoice_id',
      'stripe_subscription_id',
    ]);
    expect(mergeOrderExternalReferences(forged, current)).toEqual({ ok: true, value: current });
    expect(mergeOrderExternalReferences(forged, {})).toEqual({ ok: true, value: {} });
    expect(mergeOrderExternalReferences(removals, current)).toEqual({ ok: true, value: current });
    expect(mergeOrderExternalReferences({}, current)).toEqual({ ok: true, value: current });
  });

  it('fails safe rather than overwriting corrupt stored JSON', () => {
    expect(mergeOrderExtensions({ note: 'x' }, '{not-json')).toMatchObject({
      ok: false,
      status: 422,
    });
  });
});
