import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCloudflareContext = vi.fn();
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => getCloudflareContext(),
}));

import {
  buildTelemetryEnvelope,
  errorClass,
  MAX_TELEMETRY_JSON_BYTES,
  recordTelemetry,
  sanitizeTelemetryFields,
  serializeTelemetry,
  TELEMETRY_MARKER,
} from '@/lib/observability/telemetry';

describe('privacy-safe telemetry envelope', () => {
  const now = new Date('2026-08-11T12:00:00.000Z');
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getCloudflareContext.mockReturnValue({ env: {} });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('emits one exact machine-marked, bounded critical JSON argument', () => {
    recordTelemetry(
      'payment.intent_create_failed',
      { provider: 'stripe', path: '/api/payment-intent?token=secret' },
      new Error('raw secret and customer address'),
      { now, analytics: null },
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toHaveLength(1);
    const serialized = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual({
      marker: TELEMETRY_MARKER,
      event: 'payment.intent_create_failed',
      area: 'payment',
      severity: 'critical',
      timestamp: now.toISOString(),
      fields: { provider: 'stripe', path: '/api/payment-intent' },
      error_class: 'Error',
    });
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      MAX_TELEMETRY_JSON_BYTES,
    );
    expect(serialized).not.toContain('raw secret');
  });

  it('drops sensitive and unknown fields instead of forwarding them', () => {
    const unsafe = {
      headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
      cookie: 'secret',
      authorization: 'secret',
      payment_intent_id: 'pi_secret',
      card: '4242',
      customer_id: 'cus_secret',
      order_id: 'WEB-secret',
      email: 'person@example.com',
      url: 'https://example.com/path?token=secret',
      error: new Error('raw exception'),
      provider: 'stripe',
      retryable: true,
    };
    const fields = sanitizeTelemetryFields(unsafe);
    expect(fields).toEqual({ provider: 'stripe', retryable: true });
    expect(JSON.stringify(fields)).not.toMatch(
      /authorization|cookie|payment|card|customer|order|email|token|raw exception/i,
    );
  });

  it('bounds numeric cardinality, enum values, and query-free paths', () => {
    expect(sanitizeTelemetryFields({
      attempt: 5_000,
      count: Number.MAX_SAFE_INTEGER,
      duration_ms: 99_999_999,
      http_status: 999,
      provider: 'attacker-controlled-provider',
      outcome: 'attacker-controlled-outcome',
      path: '/safe/path?customer=secret#fragment',
    })).toEqual({
      attempt: 100,
      count: 10_000,
      duration_ms: 3_600_000,
      path: '/safe/path',
    });
  });

  it('samples expected failures but never samples critical failures', () => {
    expect(buildTelemetryEnvelope(
      'payment.pricing_rejected', {}, undefined, { now, sampleValue: 0.99 },
    )).toBeNull();
    expect(buildTelemetryEnvelope(
      'payment.pricing_rejected', {}, undefined, { now, sampleValue: 0.01 },
    )?.severity).toBe('warning');
    expect(buildTelemetryEnvelope(
      'payment.intent_create_failed', {}, undefined, { now, sampleValue: 0.99 },
    )?.severity).toBe('critical');
  });

  it('normalizes error classes into a closed low-cardinality set', () => {
    const custom = new Error('sensitive');
    custom.name = 'Customer-1234-secret';
    expect(errorClass(custom)).toBe('OtherError');
    expect(errorClass(new TypeError('sensitive'))).toBe('TypeError');
    expect(errorClass('raw secret')).toBe('NonError:string');
  });

  it('never throws for hostile getters, circular input, broken console, or serialization', () => {
    const hostile = Object.create(null, {
      provider: { enumerable: true, get: () => { throw new Error('getter secret'); } },
    });
    expect(() => sanitizeTelemetryFields(hostile)).not.toThrow();
    expect(sanitizeTelemetryFields(hostile)).toBeUndefined();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => recordTelemetry(
      'order.finalization_failed', circular, circular, { analytics: null },
    )).not.toThrow();
    errorSpy.mockImplementation(() => { throw new Error('patched console'); });
    expect(() => recordTelemetry(
      'order.finalization_failed', {}, new Error('private'), { analytics: null },
    )).not.toThrow();
    expect(serializeTelemetry({
      marker: TELEMETRY_MARKER,
      event: 'order.finalization_failed',
      area: 'order',
      severity: 'critical',
      timestamp: now.toISOString(),
      fields: circular,
    })).toBeNull();
  });

  it('writes optional Analytics Engine metrics and tolerates absent/throwing bindings', () => {
    const writeDataPoint = vi.fn();
    getCloudflareContext.mockReturnValue({ env: { COMMERCE_ANALYTICS: { writeDataPoint } } });
    expect(() => recordTelemetry(
      'refund.provider_unresolved',
      { provider: 'stripe', outcome: 'unresolved' },
      new Error('private'),
      { now },
    )).not.toThrow();
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ['refund.provider_unresolved', 'critical', 'Error', 'unresolved'],
      doubles: [1],
      indexes: ['refund'],
    });

    getCloudflareContext.mockImplementation(() => { throw new Error('no binding'); });
    expect(() => recordTelemetry('refund.provider_unresolved', {}, undefined, { now })).not.toThrow();

    expect(() => recordTelemetry('refund.provider_unresolved', {}, undefined, {
      now,
      analytics: { writeDataPoint: () => { throw new Error('AE unavailable'); } },
    })).not.toThrow();
  });
});
