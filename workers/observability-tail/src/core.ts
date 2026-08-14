export const TAIL_TELEMETRY_MARKER = 'commerce.telemetry.v1' as const;
export const MAX_TRACE_ITEMS = 50;
export const MAX_LOGS_SCANNED = 500;
export const MAX_CANDIDATE_ALERTS = 25;
export const MAX_ALERTS_PER_EMAIL = 5;
export const MAX_LOG_BYTES = 2_048;
export const MAX_EMAIL_BODY_BYTES = 32_768;

export const TAIL_CRITICAL_EVENTS = [
  'payment.inventory_check_failed',
  'payment.customer_prepare_failed',
  'payment.intent_create_failed',
  'payment.intent_invalid',
  'payment.intent_cancel_failed',
  'payment.order_persist_failed',
  'order.finalization_failed',
  'paid_effect.staging_failed',
  'paid_effect.drain_failed',
  'paid_effect.repeated_failure',
  'inventory.adjustment_repeated_failure',
  'inventory.adjustment_needs_review',
  'webhook.claim_failed',
  'webhook.ownership_lost',
  'webhook.processing_failed',
  'webhook.failure_record_failed',
  'webhook.payment_verification_rejected',
  'refund.provider_unresolved',
  'refund.provider_inconsistent',
  'refund.settlement_failed',
  'fulfillment.transition_failed',
  'recommendation.rebuild_failed',
  'cron.recovery_failed',
  'cron.analytics_failed',
] as const;

export type CriticalEvent = (typeof TAIL_CRITICAL_EVENTS)[number];

const CRITICAL_EVENT_SET: ReadonlySet<string> = new Set(TAIL_CRITICAL_EVENTS);
const ERROR_CLASSES: ReadonlySet<string> = new Set([
  'AggregateError', 'DOMException', 'Error', 'InventoryUnavailableError',
  'OtherError', 'PaymentVerificationError', 'RangeError', 'ReferenceError',
  'StripeAPIError', 'StripeAuthenticationError', 'StripeConnectionError',
  'StripeError', 'StripeIdempotencyError', 'StripeInvalidRequestError',
  'StripePermissionError', 'StripeRateLimitError',
  'StripeSignatureVerificationError', 'SyntaxError', 'TypeError',
  'NonError:boolean', 'NonError:null', 'NonError:number', 'NonError:other',
  'NonError:string',
]);
export const TAIL_ROUTE_PATHS: ReadonlySet<string> = new Set([
  '/api/admin/orders',
  '/api/admin/orders/:id/events',
  '/api/admin/orders/:id/ship',
  '/api/admin/orders/:id/shipping-email',
  '/api/admin/orders/:id/tracking',
  '/api/orders',
  '/api/orders/:id',
  '/api/orders/refund',
  '/api/payment-intent',
  '/api/webhooks/stripe',
]);

const ENUM_FIELDS: Record<string, ReadonlySet<string>> = {
  effect_type: new Set([
    'confirmation_email', 'coupon', 'gift_card', 'inventory', 'merchant_notification',
    'subscription', 'paid_decrement', 'refund_restock',
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
  provider: new Set([
    'analytics', 'carrier', 'cloudflare_email', 'd1', 'resend', 'stripe', 'workers_ai',
  ]),
  trigger: new Set(['manual', 'recovery', 'request', 'scheduled', 'webhook']),
};

export interface CriticalAlert {
  event: CriticalEvent;
  area: string;
  errorClass?: string;
  fields: Record<string, string | number | boolean>;
  bucket: string;
}

export interface ExtractedAlerts {
  alerts: CriticalAlert[];
  overflow: number;
}

export interface AlertConfiguration {
  provider: 'cloudflare' | 'resend';
  recipient: string;
  sender: string;
  subjectPrefix: string;
  operatorIdentity: string;
  environment: string;
  cooldownMs: number;
  failureBackoffMs: number;
  resendApiKey?: string;
}

export interface AlertEmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeOwnKeys(value: Record<string, unknown>): string[] {
  try {
    return Object.keys(value);
  } catch {
    return [];
  }
}

function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function sanitizeFields(value: unknown): Record<string, string | number | boolean> {
  if (!isRecord(value)) return {};
  const output: Record<string, string | number | boolean> = {};
  try {
    for (const [key, allowed] of Object.entries(ENUM_FIELDS)) {
      const candidate = value[key];
      if (typeof candidate === 'string' && allowed.has(candidate)) output[key] = candidate;
    }
    const limits = {
      attempt: [0, 100],
      count: [0, 10_000],
      duration_ms: [0, 3_600_000],
      http_status: [100, 599],
    } as const;
    for (const [key, [min, max]] of Object.entries(limits)) {
      const candidate = boundedInteger(value[key], min, max);
      if (candidate !== undefined) output[key] = candidate;
    }
    if (typeof value.retryable === 'boolean') output.retryable = value.retryable;
    if (typeof value.path === 'string' && TAIL_ROUTE_PATHS.has(value.path)) {
      output.path = value.path;
    }
  } catch {
    return {};
  }
  return output;
}

function parseEnvelope(value: unknown): CriticalAlert | null {
  if (!isRecord(value)) return null;
  const keys = safeOwnKeys(value);
  const allowedKeys = new Set([
    'marker', 'event', 'area', 'severity', 'timestamp', 'fields', 'error_class',
  ]);
  if (keys.length < 5 || keys.some((key) => !allowedKeys.has(key))) return null;
  if (value.marker !== TAIL_TELEMETRY_MARKER || value.severity !== 'critical' ||
    typeof value.event !== 'string' || !CRITICAL_EVENT_SET.has(value.event)) {
    return null;
  }
  const event = value.event as CriticalEvent;
  const area = event.slice(0, event.indexOf('.'));
  if (value.area !== area || typeof value.timestamp !== 'string' ||
    value.timestamp.length > 32 || !Number.isFinite(Date.parse(value.timestamp))) {
    return null;
  }
  const errorClass = value.error_class === undefined
    ? undefined
    : typeof value.error_class === 'string' && ERROR_CLASSES.has(value.error_class)
      ? value.error_class
      : 'OtherError';
  const fields = sanitizeFields(value.fields);
  const bucket = [
    event,
    errorClass ?? 'none',
    fields.provider ?? 'none',
    fields.effect_type ?? 'none',
    fields.outcome ?? 'none',
  ].join('|');
  return { event, area, ...(errorClass ? { errorClass } : {}), fields, bucket };
}

function parseLogMessage(message: unknown): CriticalAlert | null {
  if (!Array.isArray(message) || message.length !== 1 || typeof message[0] !== 'string') {
    return null;
  }
  const raw = message[0];
  if (raw.length === 0 || raw.length > MAX_LOG_BYTES) return null;
  try {
    return parseEnvelope(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function extractCriticalAlerts(events: readonly unknown[]): ExtractedAlerts {
  const unique = new Map<string, CriticalAlert>();
  let scanned = 0;
  let matched = 0;
  let truncated = events.length > MAX_TRACE_ITEMS;
  try {
    const traceItems = events.slice(0, MAX_TRACE_ITEMS);
    scan: for (let eventIndex = 0; eventIndex < traceItems.length; eventIndex += 1) {
      const rawEvent = traceItems[eventIndex];
      if (!isRecord(rawEvent)) continue;
      let rawLogs: unknown;
      try {
        rawLogs = Reflect.get(rawEvent, 'logs');
      } catch {
        continue;
      }
      if (!Array.isArray(rawLogs)) continue;
      for (let logIndex = 0; logIndex < rawLogs.length; logIndex += 1) {
        if (scanned >= MAX_LOGS_SCANNED) {
          truncated = true;
          break scan;
        }
        const rawLog = rawLogs[logIndex];
        scanned += 1;
        if (!isRecord(rawLog) || rawLog.level !== 'error') continue;
        const alert = parseLogMessage(rawLog.message);
        if (!alert) continue;
        matched += 1;
        if (unique.has(alert.bucket)) continue;
        unique.set(alert.bucket, alert);
        if (unique.size >= MAX_CANDIDATE_ALERTS) {
          truncated = logIndex + 1 < rawLogs.length ||
            eventIndex + 1 < traceItems.length || truncated;
          break scan;
        }
      }
    }
  } catch {
    return { alerts: [], overflow: 0 };
  }
  const alerts = [...unique.values()];
  return {
    alerts,
    overflow: Math.max(0, matched - alerts.length) + (truncated ? 1 : 0),
  };
}

function readString(source: unknown, key: string, max: number): string | null {
  try {
    if (!source || (typeof source !== 'object' && typeof source !== 'function')) return null;
    const value = Reflect.get(source, key);
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed && trimmed.length <= max && !/[\r\n\u0000]/.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

function configured(value: string | null): value is string {
  return value !== null && !/configure|example\.invalid/i.test(value);
}

function hasEmailBinding(source: unknown): boolean {
  try {
    if (!source || (typeof source !== 'object' && typeof source !== 'function')) return false;
    const binding = Reflect.get(source, 'ALERT_EMAIL');
    return binding !== null && (typeof binding === 'object' || typeof binding === 'function') &&
      typeof Reflect.get(binding, 'send') === 'function';
  } catch {
    return false;
  }
}

function email(value: string): boolean {
  return value.length <= 320 && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(value);
}

function seconds(value: string | null, fallback: number, min: number, max: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value))) * 1_000;
}

export function validateAlertConfiguration(source: unknown): AlertConfiguration | null {
  const configuredProvider = readString(source, 'EMAIL_PROVIDER', 16);
  const recipient = readString(source, 'ALERT_EMAIL_TO', 320);
  const sender = readString(source, 'ALERT_EMAIL_FROM', 320);
  const subjectPrefix = readString(source, 'ALERT_SUBJECT_PREFIX', 64);
  const operatorIdentity = readString(source, 'OPERATOR_IDENTITY', 64);
  const environment = readString(source, 'ENVIRONMENT', 32);
  const resendApiKey = readString(source, 'RESEND_API_KEY', 512);
  const cloudflareAvailable = hasEmailBinding(source);
  const resendAvailable = configured(resendApiKey);
  const provider: AlertConfiguration['provider'] | null =
    configuredProvider === 'cloudflare' || configuredProvider === 'resend'
    ? configuredProvider
    : configuredProvider === null && cloudflareAvailable !== resendAvailable
      ? cloudflareAvailable ? 'cloudflare' : 'resend'
      : null;
  if (provider === null ||
    !configured(recipient) || !configured(sender) || !configured(subjectPrefix) ||
    !configured(operatorIdentity) || !configured(environment) || !email(recipient) ||
    !email(sender) || !/^[A-Za-z0-9 ._:\-/]+$/.test(subjectPrefix) ||
    !/^[A-Za-z0-9 ._:\-/]+$/.test(operatorIdentity) ||
    !/^[A-Za-z0-9._-]+$/.test(environment)) {
    return null;
  }
  const cooldownMs = seconds(readString(source, 'ALERT_COOLDOWN_SECONDS', 8), 900, 60, 86_400);
  const failureBackoffMs = Math.min(
    seconds(readString(source, 'ALERT_FAILURE_BACKOFF_SECONDS', 8), 30, 10, 300),
    Math.floor(cooldownMs / 2),
  );
  if (provider === 'cloudflare' && !cloudflareAvailable) return null;
  const base = {
    provider, recipient, sender, subjectPrefix, operatorIdentity, environment,
    cooldownMs, failureBackoffMs,
  };
  if (provider === 'resend') {
    return configured(resendApiKey) ? { ...base, resendApiKey } : null;
  }
  return base;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function alertLine(alert: CriticalAlert): string {
  const safeFields = Object.entries(alert.fields)
    .slice(0, 10)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  return `${alert.event}${alert.errorClass ? ` (${alert.errorClass})` : ''}${safeFields ? ` — ${safeFields}` : ''}`;
}

export function renderAlert(
  alerts: readonly CriticalAlert[],
  overflow: number,
  config: Pick<AlertConfiguration, 'environment' | 'operatorIdentity'>,
): { text: string; html: string } {
  const lines = alerts.slice(0, MAX_ALERTS_PER_EMAIL).map(alertLine);
  const footer = overflow > 0 ? `\n${overflow} additional matching signal(s) were bounded or deduplicated.` : '';
  const text = `Commerce alert (${config.environment})\nOperator: ${config.operatorIdentity}\n\n${lines.join('\n')}${footer}`;
  const htmlLines = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const htmlFooter = overflow > 0
    ? `<p>${overflow} additional matching signal(s) were bounded or deduplicated.</p>`
    : '';
  const html = `<section><h1>Commerce alert — ${escapeHtml(config.environment)}</h1>` +
    `<p>Operator: ${escapeHtml(config.operatorIdentity)}</p><ul>${htmlLines}</ul>${htmlFooter}</section>`;
  return { text, html };
}

export function buildEmailMessage(
  alerts: readonly CriticalAlert[],
  overflow: number,
  config: AlertConfiguration,
): AlertEmailMessage | null {
  if (alerts.length === 0) return null;
  try {
    const rendered = renderAlert(alerts, overflow, config);
    const message: AlertEmailMessage = {
      from: config.sender,
      to: config.recipient,
      subject: `${config.subjectPrefix} ${config.environment}: ${alerts[0].event}`.slice(0, 120),
      html: rendered.html,
      text: rendered.text,
    };
    return new TextEncoder().encode(JSON.stringify(message)).byteLength <= MAX_EMAIL_BODY_BYTES
      ? message
      : null;
  } catch {
    return null;
  }
}

export function safeInternalLog(event: string, error?: unknown): void {
  try {
    const errorClass = error instanceof Error && ERROR_CLASSES.has(error.name)
      ? error.name
      : error === undefined ? undefined : 'OtherError';
    console.error(JSON.stringify({
      marker: 'commerce.observability.internal.v1',
      event: /^[a-z_]{1,64}$/.test(event) ? event : 'internal_failure',
      ...(errorClass ? { error_class: errorClass } : {}),
    }));
  } catch {
    // The alerter always fails open.
  }
}
