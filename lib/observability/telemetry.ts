import { getCloudflareContext } from '@opennextjs/cloudflare';

export const TELEMETRY_MARKER = 'commerce.telemetry.v1' as const;
export const MAX_TELEMETRY_JSON_BYTES = 2_048;

export const TELEMETRY_EVENTS = {
  'payment.pricing_rejected': { severity: 'warning', sampleRate: 0.05 },
  'payment.inventory_unavailable': { severity: 'warning', sampleRate: 0.1 },
  'payment.inventory_check_failed': { severity: 'critical', sampleRate: 1 },
  'payment.customer_prepare_failed': { severity: 'critical', sampleRate: 1 },
  'payment.intent_create_failed': { severity: 'critical', sampleRate: 1 },
  'payment.intent_invalid': { severity: 'critical', sampleRate: 1 },
  'payment.intent_cancel_failed': { severity: 'critical', sampleRate: 1 },
  'payment.order_persist_failed': { severity: 'critical', sampleRate: 1 },
  'order.payment_verification_rejected': { severity: 'warning', sampleRate: 0.1 },
  'order.finalization_failed': { severity: 'critical', sampleRate: 1 },
  'paid_effect.staging_failed': { severity: 'critical', sampleRate: 1 },
  'paid_effect.first_attempt_failed': { severity: 'error', sampleRate: 0.25 },
  'paid_effect.repeated_failure': { severity: 'critical', sampleRate: 1 },
  'inventory.adjustment_first_attempt_failed': { severity: 'error', sampleRate: 0.25 },
  'inventory.adjustment_repeated_failure': { severity: 'critical', sampleRate: 1 },
  'inventory.adjustment_needs_review': { severity: 'critical', sampleRate: 1 },
  'webhook.signature_rejected': { severity: 'warning', sampleRate: 0.01 },
  'webhook.claim_failed': { severity: 'critical', sampleRate: 1 },
  'webhook.ownership_lost': { severity: 'critical', sampleRate: 1 },
  'webhook.processing_failed': { severity: 'critical', sampleRate: 1 },
  'webhook.failure_record_failed': { severity: 'critical', sampleRate: 1 },
  'webhook.payment_verification_rejected': { severity: 'critical', sampleRate: 1 },
  'refund.request_rejected': { severity: 'warning', sampleRate: 0.05 },
  'refund.provider_unresolved': { severity: 'critical', sampleRate: 1 },
  'refund.provider_inconsistent': { severity: 'critical', sampleRate: 1 },
  'refund.settlement_failed': { severity: 'critical', sampleRate: 1 },
  'fulfillment.transition_failed': { severity: 'critical', sampleRate: 1 },
  'email.delivery_failed': { severity: 'error', sampleRate: 0.25 },
  'email.audit_write_failed': { severity: 'error', sampleRate: 0.25 },
  'recommendation.rebuild_failed': { severity: 'critical', sampleRate: 1 },
  'recommendation.no_rows_written': { severity: 'warning', sampleRate: 0.25 },
  'recommendation.stale_rows': { severity: 'warning', sampleRate: 0.25 },
  'cron.recovery_failed': { severity: 'critical', sampleRate: 1 },
} as const;

export type TelemetryEvent = keyof typeof TELEMETRY_EVENTS;
export type TelemetrySeverity =
  (typeof TELEMETRY_EVENTS)[TelemetryEvent]['severity'];

const ALLOWED_ERROR_CLASSES = new Set([
  'AggregateError',
  'DOMException',
  'Error',
  'InventoryUnavailableError',
  'PaymentVerificationError',
  'RangeError',
  'ReferenceError',
  'StripeAPIError',
  'StripeAuthenticationError',
  'StripeConnectionError',
  'StripeError',
  'StripeIdempotencyError',
  'StripeInvalidRequestError',
  'StripePermissionError',
  'StripeRateLimitError',
  'StripeSignatureVerificationError',
  'SyntaxError',
  'TypeError',
]);

const ALLOWED_FIELD_ENUMS = {
  effect_type: new Set([
    'confirmation_email', 'coupon', 'gift_card', 'inventory', 'subscription',
    'paid_decrement', 'refund_restock',
  ]),
  operation: new Set([
    'audit_write', 'claim', 'complete', 'create', 'finalize', 'persist',
    'process', 'rebuild', 'record_failure', 'send', 'stage', 'transition',
    'validate',
  ]),
  outcome: new Set([
    'conflict', 'failed', 'invalid', 'needs_review', 'partial_failure',
    'rejected', 'retry_scheduled', 'unavailable', 'unresolved',
  ]),
  provider: new Set(['analytics', 'carrier', 'd1', 'resend', 'stripe', 'workers_ai']),
  trigger: new Set(['manual', 'recovery', 'request', 'scheduled', 'webhook']),
} as const;

type EnumField = keyof typeof ALLOWED_FIELD_ENUMS;
type NumberField = 'attempt' | 'count' | 'duration_ms' | 'http_status';
type BooleanField = 'retryable';

export type TelemetryFields = Partial<
  Record<EnumField, string> &
  Record<NumberField, number> &
  Record<BooleanField, boolean> & {
    path: string;
  }
>;

export interface TelemetryEnvelope {
  marker: typeof TELEMETRY_MARKER;
  event: TelemetryEvent;
  area: string;
  severity: TelemetrySeverity;
  timestamp: string;
  fields?: TelemetryFields;
  error_class?: string;
}

interface AnalyticsWriter {
  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

export interface TelemetryOptions {
  analytics?: AnalyticsWriter | null;
  now?: Date;
  sampleValue?: number;
}

function boundedInteger(value: unknown, maximum: number): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : undefined;
}

function queryFreePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 160) {
    return undefined;
  }
  const withoutQuery = value.split(/[?#]/, 1)[0];
  if (!withoutQuery || withoutQuery.length > 128 || /[\u0000-\u001f\u007f]/.test(withoutQuery)) {
    return undefined;
  }
  return withoutQuery;
}

export function sanitizeTelemetryFields(value: unknown): TelemetryFields | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const source = value as Record<string, unknown>;
    const fields: TelemetryFields = {};

    for (const key of Object.keys(ALLOWED_FIELD_ENUMS) as EnumField[]) {
      const candidate = source[key];
      if (typeof candidate === 'string' && ALLOWED_FIELD_ENUMS[key].has(candidate)) {
        fields[key] = candidate;
      }
    }

    const attempt = boundedInteger(source.attempt, 100);
    const count = boundedInteger(source.count, 10_000);
    const duration = boundedInteger(source.duration_ms, 3_600_000);
    const status = typeof source.http_status === 'number' &&
      Number.isSafeInteger(source.http_status) &&
      source.http_status >= 100 && source.http_status <= 599
      ? source.http_status
      : undefined;
    if (attempt !== undefined) fields.attempt = attempt;
    if (count !== undefined) fields.count = count;
    if (duration !== undefined) fields.duration_ms = duration;
    if (status !== undefined) fields.http_status = status;
    if (typeof source.retryable === 'boolean') fields.retryable = source.retryable;

    const path = queryFreePath(source.path);
    if (path) fields.path = path;
    return Object.keys(fields).length > 0 ? fields : undefined;
  } catch {
    return undefined;
  }
}

export function errorClass(error: unknown): string | undefined {
  try {
    if (error instanceof Error) {
      return ALLOWED_ERROR_CLASSES.has(error.name) ? error.name : 'OtherError';
    }
    if (error === null) return 'NonError:null';
    const primitive = typeof error;
    return primitive === 'string' || primitive === 'number' || primitive === 'boolean'
      ? `NonError:${primitive}`
      : 'NonError:other';
  } catch {
    return 'OtherError';
  }
}

function safeTimestamp(now: Date | undefined): string {
  try {
    const value = now ?? new Date();
    return Number.isFinite(value.getTime()) ? value.toISOString() : '1970-01-01T00:00:00.000Z';
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

export function buildTelemetryEnvelope(
  event: TelemetryEvent,
  fields?: unknown,
  error?: unknown,
  options: Pick<TelemetryOptions, 'now' | 'sampleValue'> = {},
): TelemetryEnvelope | null {
  try {
    const definition = TELEMETRY_EVENTS[event];
    if (!definition) return null;
    const sampleValue = options.sampleValue ?? Math.random();
    if (definition.sampleRate < 1 &&
      (!Number.isFinite(sampleValue) || sampleValue < 0 || sampleValue >= definition.sampleRate)) {
      return null;
    }
    const safeFields = sanitizeTelemetryFields(fields);
    const envelope: TelemetryEnvelope = {
      marker: TELEMETRY_MARKER,
      event,
      area: event.slice(0, event.indexOf('.')),
      severity: definition.severity,
      timestamp: safeTimestamp(options.now),
      ...(safeFields ? { fields: safeFields } : {}),
    };
    const safeClass = error === undefined ? undefined : errorClass(error);
    if (safeClass) envelope.error_class = safeClass;
    return envelope;
  } catch {
    return null;
  }
}

export function serializeTelemetry(envelope: TelemetryEnvelope): string | null {
  try {
    const serialized = JSON.stringify(envelope);
    return new TextEncoder().encode(serialized).byteLength <= MAX_TELEMETRY_JSON_BYTES
      ? serialized
      : null;
  } catch {
    return null;
  }
}

function optionalAnalytics(): AnalyticsWriter | null {
  try {
    const { env } = getCloudflareContext();
    const candidate = Reflect.get(env, 'COMMERCE_ANALYTICS');
    return candidate && typeof candidate === 'object' &&
      typeof Reflect.get(candidate, 'writeDataPoint') === 'function'
      ? candidate as AnalyticsWriter
      : null;
  } catch {
    return null;
  }
}

function writeMetric(envelope: TelemetryEnvelope, analytics: AnalyticsWriter | null): void {
  try {
    analytics?.writeDataPoint({
      blobs: [
        envelope.event,
        envelope.severity,
        envelope.error_class ?? 'none',
        envelope.fields?.outcome ?? 'none',
      ],
      doubles: [1],
      indexes: [envelope.area],
    });
  } catch {
    // Telemetry must always fail open.
  }
}

export function recordTelemetry(
  event: TelemetryEvent,
  fields?: unknown,
  error?: unknown,
  options: TelemetryOptions = {},
): void {
  try {
    const envelope = buildTelemetryEnvelope(event, fields, error, options);
    if (!envelope) return;
    const serialized = serializeTelemetry(envelope);
    if (!serialized) return;
    try {
      if (envelope.severity === 'critical' || envelope.severity === 'error') {
        console.error(serialized);
      } else if (envelope.severity === 'warning') {
        console.warn(serialized);
      } else {
        console.info(serialized);
      }
    } catch {
      // A patched console must not affect commerce.
    }
    writeMetric(
      envelope,
      options.analytics === undefined ? optionalAnalytics() : options.analytics,
    );
  } catch {
    // Telemetry must always fail open.
  }
}
