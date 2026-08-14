import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_EVENTS,
  TELEMETRY_MARKER,
  TELEMETRY_PATHS,
} from '@/lib/observability/telemetry';
import {
  buildEmailMessage,
  escapeHtml,
  extractCriticalAlerts,
  MAX_CANDIDATE_ALERTS,
  renderAlert,
  TAIL_CRITICAL_EVENTS,
  TAIL_ROUTE_PATHS,
  TAIL_TELEMETRY_MARKER,
  validateAlertConfiguration,
} from '@/workers/observability-tail/src/core';

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    marker: TAIL_TELEMETRY_MARKER,
    event: 'payment.intent_create_failed',
    area: 'payment',
    severity: 'critical',
    timestamp: '2026-08-11T12:00:00.000Z',
    fields: { provider: 'stripe', retryable: true, path: '/api/payment-intent' },
    error_class: 'StripeConnectionError',
    ...overrides,
  };
}

function trace(payload: unknown, level = 'error', extraArgs: unknown[] = []): unknown {
  return {
    logs: [{ level, message: [JSON.stringify(payload), ...extraArgs] }],
    outcome: 'ok',
    exceptions: [{ name: 'Error', message: 'raw exception must be ignored' }],
    event: {
      request: {
        headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
        url: 'https://shop.example/api?token=secret',
      },
    },
  };
}

const configured = {
  EMAIL_PROVIDER: 'cloudflare',
  ALERT_EMAIL: { send: async () => undefined },
  ALERT_EMAIL_TO: 'operator@merchant.test',
  ALERT_EMAIL_FROM: 'alerts@merchant.test',
  ALERT_SUBJECT_PREFIX: 'Commerce alert',
  OPERATOR_IDENTITY: 'on-call',
  ENVIRONMENT: 'production',
  ALERT_COOLDOWN_SECONDS: '900',
  ALERT_FAILURE_BACKOFF_SECONDS: '30',
};

describe('observability Tail Worker parser and renderer', () => {
  it('keeps the exact producer marker and critical taxonomy synchronized', () => {
    expect(TAIL_TELEMETRY_MARKER).toBe(TELEMETRY_MARKER);
    for (const event of TAIL_CRITICAL_EVENTS) {
      expect(TELEMETRY_EVENTS[event].severity).toBe('critical');
    }
    expect([...TAIL_ROUTE_PATHS]).toEqual([...TELEMETRY_PATHS]);
  });

  it('keeps documented telemetry paths inside the closed route contract', () => {
    const documentation = readFileSync(join(process.cwd(), 'docs/observability.md'), 'utf8');
    const documentedPaths = [...documentation.matchAll(/path:\s*`?"([^"]+)"/g)]
      .map((match) => match[1]);
    expect(documentedPaths).not.toHaveLength(0);
    expect(documentedPaths.every((path) => TELEMETRY_PATHS.has(path))).toBe(true);
  });

  it('accepts only an exact one-argument structured critical marker', () => {
    expect(extractCriticalAlerts([trace(envelope())]).alerts).toHaveLength(1);
    expect(extractCriticalAlerts([trace(envelope({ marker: `${TAIL_TELEMETRY_MARKER}.suffix` }))]).alerts)
      .toHaveLength(0);
    expect(extractCriticalAlerts([trace(envelope(), 'warn')]).alerts).toHaveLength(0);
    expect(extractCriticalAlerts([trace(envelope(), 'error', ['smuggled'])]).alerts).toHaveLength(0);
    expect(extractCriticalAlerts([trace(envelope({ severity: 'error' }))]).alerts).toHaveLength(0);
    expect(extractCriticalAlerts([trace(envelope({ unknown: 'smuggled' }))]).alerts).toHaveLength(0);
  });

  it('re-sanitizes fields and never consumes trace headers, URLs, exceptions, or unknown data', () => {
    const unsafe = envelope({
      fields: {
        provider: 'stripe',
        outcome: 'failed',
        path: '/safe?token=secret',
        attempt: 999,
        customer_id: 'customer-secret',
        order_id: 'order-secret',
        payment_intent: 'pi_secret',
        headers: { cookie: 'secret', authorization: 'secret' },
        raw_exception: 'address and token',
      },
      error_class: 'AttackerControlledCustomer123',
    });
    const alert = extractCriticalAlerts([trace(unsafe)]).alerts[0];
    expect(alert).toMatchObject({
      event: 'payment.intent_create_failed',
      errorClass: 'OtherError',
      fields: { provider: 'stripe', outcome: 'failed' },
    });
    const serialized = JSON.stringify(alert);
    expect(serialized).not.toMatch(
      /secret|cookie|authorization|customer|order|payment_intent|raw_exception|token/i,
    );
  });

  it('preserves the merchant notification effect in its own cooldown bucket', () => {
    const alert = extractCriticalAlerts([trace(envelope({
      event: 'paid_effect.repeated_failure',
      area: 'paid_effect',
      fields: {
        effect_type: 'merchant_notification',
        outcome: 'needs_review',
        retryable: false,
      },
    }))]).alerts[0];
    expect(alert.fields).toEqual({
      effect_type: 'merchant_notification',
      outcome: 'needs_review',
      retryable: false,
    });
    expect(alert.bucket).toBe(
      'paid_effect.repeated_failure|StripeConnectionError|none|merchant_notification|needs_review',
    );
  });

  it('deduplicates by a closed low-cardinality bucket and caps scanning work', () => {
    const repeated = Array.from({ length: MAX_CANDIDATE_ALERTS + 20 }, () => trace(envelope()));
    const distinct = trace(envelope({
      event: 'refund.settlement_failed',
      area: 'refund',
    }));
    const extracted = extractCriticalAlerts([...repeated, distinct]);
    expect(extracted.alerts).toHaveLength(2);
    expect(extracted.overflow).toBeGreaterThan(0);
    expect(extracted.alerts[0].bucket).toBe(
      'payment.intent_create_failed|StripeConnectionError|stripe|none|none',
    );
    expect(extracted.alerts[1].bucket).toBe(
      'refund.settlement_failed|StripeConnectionError|stripe|none|none',
    );
  });

  it('requires complete non-placeholder config and bounds cooldown values', () => {
    expect(validateAlertConfiguration({})).toBeNull();
    expect(validateAlertConfiguration({ ...configured, ALERT_EMAIL_TO: 'configure@example.invalid' }))
      .toBeNull();
    expect(validateAlertConfiguration({ ...configured, ALERT_EMAIL_TO: 'a@test,b@test' }))
      .toBeNull();
    expect(validateAlertConfiguration({ ...configured, EMAIL_PROVIDER: 'auto' })).toBeNull();
    expect(validateAlertConfiguration({ ...configured, EMAIL_PROVIDER: 'resend' })).toBeNull();
    expect(validateAlertConfiguration({
      ...configured,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'test-api-key',
    })).toMatchObject({ provider: 'resend', resendApiKey: 'test-api-key' });
    expect(validateAlertConfiguration({
      ...configured,
      ALERT_COOLDOWN_SECONDS: '9999999',
      ALERT_FAILURE_BACKOFF_SECONDS: '9999999',
    })).toMatchObject({
      cooldownMs: 86_400_000,
      failureBackoffMs: 300_000,
    });
    const { EMAIL_PROVIDER: _provider, ALERT_EMAIL: _binding, ...base } = configured;
    expect(validateAlertConfiguration({ ...base, ALERT_EMAIL: configured.ALERT_EMAIL }))
      .toMatchObject({ provider: 'cloudflare' });
    expect(validateAlertConfiguration({ ...base, RESEND_API_KEY: 'test-api-key' }))
      .toMatchObject({ provider: 'resend' });
    expect(validateAlertConfiguration({
      ...base,
      ALERT_EMAIL: configured.ALERT_EMAIL,
      RESEND_API_KEY: 'test-api-key',
    })).toBeNull();
  });

  it('HTML-escapes every configured and alert value and includes a text alternative', () => {
    const alert = extractCriticalAlerts([trace(envelope({
      fields: { provider: 'stripe', path: '/safe/<script>' },
    }))]).alerts[0];
    const rendered = renderAlert([alert], 2, {
      environment: '<prod>',
      operatorIdentity: 'ops & safety',
    });
    expect(rendered.html).toContain('&lt;prod&gt;');
    expect(rendered.html).toContain('ops &amp; safety');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.text).toContain('additional matching signal');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('builds one bounded native Email Sending message with configured identity', () => {
    const config = validateAlertConfiguration(configured);
    expect(config).not.toBeNull();
    const alert = extractCriticalAlerts([trace(envelope())]).alerts[0];
    expect(buildEmailMessage([alert], 0, config!)).toMatchObject({
      from: configured.ALERT_EMAIL_FROM,
      to: configured.ALERT_EMAIL_TO,
      subject: expect.stringContaining(configured.ALERT_SUBJECT_PREFIX),
      html: expect.any(String),
      text: expect.any(String),
    });
  });

  it('fails closed on malformed and hostile inputs without throwing', () => {
    const hostile = Object.create(null, {
      logs: { get: () => { throw new Error('secret getter'); } },
    });
    expect(() => extractCriticalAlerts([hostile, null, 'bad'])).not.toThrow();
    expect(extractCriticalAlerts([hostile, null, 'bad']).alerts).toEqual([]);
    expect(() => validateAlertConfiguration(Object.create(null, {
      ALERT_EMAIL_TO: { get: () => { throw new Error('secret getter'); } },
    }))).not.toThrow();
  });
});
