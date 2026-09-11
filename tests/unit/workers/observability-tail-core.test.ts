import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FIELD_ENUMS,
  DELIVERY_ID_MAX_LENGTH as TELEMETRY_DELIVERY_ID_MAX_LENGTH,
  sanitizeTelemetryFields,
  TELEMETRY_EVENTS,
  TELEMETRY_MARKER,
  TELEMETRY_PATHS,
} from '@/lib/observability/telemetry';
import {
  buildEmailMessage,
  DELIVERY_ID_MAX_LENGTH as TAIL_DELIVERY_ID_MAX_LENGTH,
  ENUM_FIELDS,
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

  it('registers theme.unknown_selection at warning severity outside the tail critical list', () => {
    // D-12 / RESEARCH Pitfall 4: this is a warning-severity, non-payment
    // event. TAIL_CRITICAL_EVENTS is structurally critical-only (enforced
    // above and by the tail parser's own runtime severity guard), so this
    // event must be registered in TELEMETRY_EVENTS without ever joining
    // that array.
    expect(TELEMETRY_EVENTS['theme.unknown_selection']).toEqual({
      severity: 'warning',
      sampleRate: 1,
    });
    expect(TAIL_CRITICAL_EVENTS).not.toContain('theme.unknown_selection');
  });

  it('registers gift_card.delivery_retry at warning severity outside the tail critical list', () => {
    // D-04: a delivery that will be retried automatically records a
    // non-paging warning event, structurally absent from the critical-only
    // list — same reasoning as theme.unknown_selection above. Only the
    // terminal gift_card.delivery_failed event pages.
    expect(TELEMETRY_EVENTS['gift_card.delivery_retry']).toEqual({
      severity: 'warning',
      sampleRate: 1,
    });
    expect(TAIL_CRITICAL_EVENTS).not.toContain('gift_card.delivery_retry');
  });

  it('registers layout.unknown_selection at warning severity outside the tail critical list', () => {
    // D-03 / RESEARCH: a second warning-severity, non-payment event,
    // structurally absent from the critical-only list — same reasoning as
    // theme.unknown_selection immediately above.
    expect(TELEMETRY_EVENTS['layout.unknown_selection']).toEqual({
      severity: 'warning',
      sampleRate: 1,
    });
    expect(TAIL_CRITICAL_EVENTS).not.toContain('layout.unknown_selection');
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

  // CR-01: a gift_card.delivery_failed envelope (critical, in TAIL_CRITICAL_EVENTS,
  // the exact event this worker turns into a paging alert email) must carry its
  // delivery_id all the way through parseEnvelope -> sanitizeFields -> alertLine ->
  // the rendered email body, not just the raw producer-side log line.
  it('carries delivery_id from a gift_card.delivery_failed envelope into the alert payload and rendered email (CR-01)', () => {
    const deliveryId = 'gift_delivery_02419c227ba01eae595c700f92856d6ea6eb4ac54ea49d20d0731d1ad9d83d14';
    const alert = extractCriticalAlerts([trace(envelope({
      event: 'gift_card.delivery_failed',
      area: 'gift_card',
      fields: {
        operation: 'send', outcome: 'failed', provider: 'cloudflare_email',
        trigger: 'recovery', retryable: false, attempt: 8, delivery_id: deliveryId,
      },
    }))]).alerts[0];
    expect(alert.fields.delivery_id).toBe(deliveryId);

    const rendered = renderAlert([alert], 0, { environment: 'production', operatorIdentity: 'on-call' });
    expect(rendered.text).toContain(deliveryId);
    expect(rendered.html).toContain(deliveryId);
  });

  it('drops a delivery_id that fails the bound/charset check the same way sanitizeTelemetryFields does', () => {
    const alert = extractCriticalAlerts([trace(envelope({
      event: 'gift_card.delivery_failed',
      area: 'gift_card',
      fields: {
        operation: 'send', outcome: 'failed', provider: 'cloudflare_email',
        trigger: 'recovery', retryable: false, attempt: 8,
        delivery_id: 'not a safe id; has spaces and secret@example.com',
      },
    }))]).alerts[0];
    expect(alert.fields).not.toHaveProperty('delivery_id');
  });
});

describe('ENUM_FIELDS parity with lib/observability/telemetry.ts', () => {
  it('mirrors ALLOWED_FIELD_ENUMS field-for-field and value-for-value', () => {
    // lib/observability/telemetry.ts is the source of truth for this closed taxonomy.
    // core.ts's sanitizeFields() silently drops any field/value not in its own enum, so
    // drift here means a critical alert email silently loses a diagnostic field with no
    // test failure to catch it (see 01-REVIEW.md WR-05). Assert byte-equal parity so
    // future drift fails loudly instead of silently.
    expect(Object.keys(ENUM_FIELDS).sort()).toEqual(Object.keys(ALLOWED_FIELD_ENUMS).sort());
    for (const key of Object.keys(ALLOWED_FIELD_ENUMS) as (keyof typeof ALLOWED_FIELD_ENUMS)[]) {
      expect([...ENUM_FIELDS[key]].sort()).toEqual([...ALLOWED_FIELD_ENUMS[key]].sort());
    }
  });

  // CR-01: ENUM_FIELDS parity above only ever covered the six closed-enum keys
  // -- it structurally cannot see delivery_id, which is handled by ad hoc
  // imperative code in both files, not an enum object. That gap is exactly
  // what let the tail worker silently drop delivery_id after WR-01 added it
  // to the producer side. Assert both the bound and the accept/reject
  // behavior stay identical between the two independent sanitizers.
  it('mirrors delivery_id bound and charset behavior with lib/observability/telemetry.ts (CR-01)', () => {
    expect(TAIL_DELIVERY_ID_MAX_LENGTH).toBe(TELEMETRY_DELIVERY_ID_MAX_LENGTH);

    const candidates = [
      'gift_delivery_02419c227ba01eae595c700f92856d6ea6eb4ac54ea49d20d0731d1ad9d83d14',
      'gift_delivery_admin_9d3629d09eb31182dc3df8078682f9a463b657b17815d1f5b798c286f317d15c',
      '', // empty
      'a'.repeat(TAIL_DELIVERY_ID_MAX_LENGTH), // exactly at the bound: accepted
      'a'.repeat(TAIL_DELIVERY_ID_MAX_LENGTH + 1), // over the bound: rejected
      'friend@example.com', // free text / PII-shaped
      'note with spaces',
      123 as unknown as string, // wrong type
    ];

    for (const candidate of candidates) {
      const producerAccepted = sanitizeTelemetryFields({ delivery_id: candidate })?.delivery_id;
      const consumerAlert = extractCriticalAlerts([trace(envelope({
        event: 'gift_card.delivery_failed',
        area: 'gift_card',
        fields: { provider: 'd1', outcome: 'failed', delivery_id: candidate },
      }))]).alerts[0];
      const consumerAccepted = consumerAlert?.fields.delivery_id;
      expect(consumerAccepted, `delivery_id candidate: ${JSON.stringify(candidate)}`).toBe(producerAccepted);
    }
  });
});
