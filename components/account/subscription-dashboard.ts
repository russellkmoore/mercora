export const SUBSCRIPTION_STATUSES = [
  'pending',
  'provider_created',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
  'unpaid',
] as const;

export type CustomerSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface CustomerSubscriptionSummary {
  id: string;
  planId: string;
  quantity: number;
  status: CustomerSubscriptionStatus;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: number;
  canceledAt?: number;
  endedAt?: number;
  /** Forward-compatible safe field; provider identifiers are never retained. */
  pauseCollection?: {
    behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void';
    resumesAt?: number;
  };
}

export type CustomerSubscriptionAction =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'cancel'; mode: 'period_end' | 'immediate' };

export type SubscriptionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_SUBSCRIPTIONS = 100;
const MAX_EPOCH_SECONDS = 8_640_000_000;
const STATUS_SET = new Set<string>(SUBSCRIPTION_STATUSES);
const ID_PATTERN = /^[^\s/]{1,128}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function optionalEpoch(value: unknown): value is number | undefined {
  return value === undefined
    || (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= MAX_EPOCH_SECONDS);
}

function parsePauseCollection(value: unknown): CustomerSubscriptionSummary['pauseCollection'] {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)
    || Object.keys(value).some((key) => key !== 'behavior' && key !== 'resumesAt')
    || !['keep_as_draft', 'mark_uncollectible', 'void'].includes(String(value.behavior))
    || !optionalEpoch(value.resumesAt)) {
    throw new Error('Subscription response contains invalid pause state');
  }
  return {
    behavior: value.behavior as NonNullable<CustomerSubscriptionSummary['pauseCollection']>['behavior'],
    ...(value.resumesAt === undefined ? {} : { resumesAt: Number(value.resumesAt) }),
  };
}

function parseSummary(value: unknown): CustomerSubscriptionSummary {
  if (!isPlainRecord(value)
    || !ID_PATTERN.test(String(value.id ?? ''))
    || !ID_PATTERN.test(String(value.planId ?? ''))
    || !Number.isSafeInteger(value.quantity)
    || Number(value.quantity) < 1
    || Number(value.quantity) > 1000
    || !STATUS_SET.has(String(value.status ?? ''))
    || !optionalEpoch(value.currentPeriodStart)
    || !optionalEpoch(value.currentPeriodEnd)
    || !optionalEpoch(value.cancelAt)
    || !optionalEpoch(value.canceledAt)
    || !optionalEpoch(value.endedAt)
    || (value.cancelAtPeriodEnd !== undefined && typeof value.cancelAtPeriodEnd !== 'boolean')) {
    throw new Error('Subscription response contains invalid data');
  }
  if (value.currentPeriodStart !== undefined && value.currentPeriodEnd !== undefined
    && Number(value.currentPeriodEnd) < Number(value.currentPeriodStart)) {
    throw new Error('Subscription response contains an invalid billing period');
  }
  return {
    id: String(value.id),
    planId: String(value.planId),
    quantity: Number(value.quantity),
    status: String(value.status) as CustomerSubscriptionStatus,
    ...(value.currentPeriodStart === undefined ? {} : { currentPeriodStart: Number(value.currentPeriodStart) }),
    ...(value.currentPeriodEnd === undefined ? {} : { currentPeriodEnd: Number(value.currentPeriodEnd) }),
    ...(value.cancelAtPeriodEnd === undefined ? {} : { cancelAtPeriodEnd: value.cancelAtPeriodEnd }),
    ...(value.cancelAt === undefined ? {} : { cancelAt: Number(value.cancelAt) }),
    ...(value.canceledAt === undefined ? {} : { canceledAt: Number(value.canceledAt) }),
    ...(value.endedAt === undefined ? {} : { endedAt: Number(value.endedAt) }),
    ...(value.pauseCollection === undefined
      ? {}
      : { pauseCollection: parsePauseCollection(value.pauseCollection) }),
  };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error('Subscription response is too large');
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('Subscription response is too large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Subscription service returned an invalid response');
  }
}

function responseError(value: unknown, fallback: string): Error {
  const message = isPlainRecord(value) && typeof value.error === 'string'
    && value.error.trim() === value.error && value.error.length > 0 && value.error.length <= 200
    ? value.error
    : fallback;
  return new Error(message);
}

export async function fetchCustomerSubscriptions(
  fetcher: SubscriptionFetch = fetch,
): Promise<CustomerSubscriptionSummary[]> {
  const response = await fetcher('/api/subscriptions', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  const body = await readBoundedJson(response);
  if (!response.ok) throw responseError(body, 'Subscriptions could not be loaded');
  if (!isPlainRecord(body) || !Array.isArray(body.subscriptions)
    || body.subscriptions.length > MAX_SUBSCRIPTIONS) {
    throw new Error('Subscription service returned an invalid response');
  }
  return body.subscriptions.map(parseSummary);
}

function actionRequest(action: CustomerSubscriptionAction): RequestInit {
  return {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: action.type === 'cancel'
      ? JSON.stringify({ mode: action.mode })
      : JSON.stringify({}),
  };
}

export async function submitCustomerSubscriptionAction(args: {
  id: string;
  action: CustomerSubscriptionAction;
  refresh: () => Promise<void>;
  fetcher?: SubscriptionFetch;
}): Promise<void> {
  if (!ID_PATTERN.test(args.id)) throw new Error('Subscription identity is invalid');
  const fetcher = args.fetcher ?? fetch;
  const response = await fetcher(
    `/api/subscriptions/${encodeURIComponent(args.id)}/${args.action.type}`,
    actionRequest(args.action),
  );
  const body = await readBoundedJson(response);
  if (response.status !== 202 || !response.ok) {
    throw responseError(body, 'Subscription change could not be requested');
  }
  if (!isPlainRecord(body) || body.reconciliationPending !== true) {
    throw new Error('Subscription service returned an invalid action response');
  }
  await args.refresh();
}

export function formatSubscriptionDate(epochSeconds: number | undefined): string | undefined {
  if (!optionalEpoch(epochSeconds) || epochSeconds === undefined) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(epochSeconds * 1000));
}

export function subscriptionStatusLabel(status: CustomerSubscriptionStatus): string {
  return status.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}
