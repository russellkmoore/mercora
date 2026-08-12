import { describe, expect, it, vi } from 'vitest';
import {
  TAIL_TELEMETRY_MARKER,
  type AlertConfiguration,
  type AlertEmailMessage,
} from '@/workers/observability-tail/src/core';
import { processTailEvents } from '@/workers/observability-tail/src/handler';

const configured = {
  EMAIL_PROVIDER: 'cloudflare',
  ALERT_EMAIL: { send: async () => undefined },
  ALERT_EMAIL_TO: 'operator@merchant.test',
  ALERT_EMAIL_FROM: 'alerts@merchant.test',
  ALERT_SUBJECT_PREFIX: 'Commerce alert',
  OPERATOR_IDENTITY: 'on-call',
  ENVIRONMENT: 'test',
  ALERT_COOLDOWN_SECONDS: '900',
  ALERT_FAILURE_BACKOFF_SECONDS: '30',
};

function criticalTrace(event: string): unknown {
  return {
    logs: [{
      level: 'error',
      message: [JSON.stringify({
        marker: TAIL_TELEMETRY_MARKER,
        event,
        area: event.slice(0, event.indexOf('.')),
        severity: 'critical',
        timestamp: '2026-08-11T12:00:00.000Z',
        fields: { provider: 'd1', outcome: 'failed' },
        error_class: 'Error',
      })],
    }],
  };
}

describe('observability Tail Worker processing', () => {
  it('continues past five cooled buckets to deliver a sixth fresh bucket', async () => {
    const events = [
      'payment.inventory_check_failed',
      'payment.customer_prepare_failed',
      'payment.intent_create_failed',
      'payment.intent_invalid',
      'payment.intent_cancel_failed',
      'refund.settlement_failed',
    ].map(criticalTrace);
    const env: ObservabilityTailEnv = Object.assign(Object.create(null), configured);
    let attempts = 0;
    let delivered: AlertEmailMessage | null = null;
    const send = vi.fn(async (
      message: AlertEmailMessage,
      _configuration: AlertConfiguration,
      _source: unknown,
    ) => {
      delivered = message;
    });

    await processTailEvents(events, env, 1_000_000, {
      reserve: async (alert) => {
        attempts += 1;
        if (attempts <= 5) return { outcome: 'suppressed' };
        return {
          outcome: 'reserved',
          value: {
            alert,
            reservation: { reservedUntil: 1_900_000 },
            shortenAfterFailure: async () => undefined,
          },
        };
      },
      send,
    });

    expect(attempts).toBe(6);
    expect(send).toHaveBeenCalledOnce();
    expect(delivered).not.toBeNull();
    expect(delivered!.text).toContain('refund.settlement_failed');
    expect(delivered!.text).not.toContain('additional matching signal');
  });
});
