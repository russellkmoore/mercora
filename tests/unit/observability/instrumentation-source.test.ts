import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const instrumentation = {
  'app/api/payment-intent/route.ts': [
    'payment.pricing_rejected',
    'payment.inventory_unavailable',
    'payment.intent_create_failed',
    'payment.order_persist_failed',
  ],
  'app/api/orders/route.ts': [
    'order.payment_verification_rejected',
    'order.finalization_failed',
  ],
  'app/api/webhooks/stripe/route.ts': [
    'webhook.signature_rejected',
    'webhook.claim_failed',
    'webhook.processing_failed',
    'webhook.failure_record_failed',
  ],
  'app/api/orders/refund/route.ts': [
    'refund.request_rejected',
    'refund.provider_unresolved',
    'refund.provider_inconsistent',
    'refund.settlement_failed',
  ],
  'lib/services/order-effects.ts': [
    'paid_effect.repeated_failure',
    'paid_effect.first_attempt_failed',
  ],
  'lib/services/inventory-adjustments.ts': [
    'inventory.adjustment_repeated_failure',
    'inventory.adjustment_needs_review',
  ],
  'lib/fulfillment/shipping-email.ts': [
    'email.delivery_failed',
    'email.audit_write_failed',
  ],
  'lib/recommendations/cron.ts': ['recommendation.rebuild_failed'],
  'worker.ts': ['cron.recovery_failed'],
} as const;

describe('actionable failure telemetry wiring', () => {
  it('covers current commerce and operational paths with the closed taxonomy', () => {
    for (const [path, events] of Object.entries(instrumentation)) {
      const source = readFileSync(path, 'utf8');
      for (const event of events) expect(source, `${path}: ${event}`).toContain(event);
    }
  });

  it('does not retain raw exception console logging in instrumented boundaries', () => {
    for (const path of Object.keys(instrumentation)) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/console\.error\s*\(/);
    }
  });
});
