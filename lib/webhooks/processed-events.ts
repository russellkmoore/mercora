import { getCloudflareContext } from '@opennextjs/cloudflare';

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MAX_ERROR_LENGTH = 2_000;

type SqlValue = string | number | null;

export interface ProcessedEventsExecutor {
  first<T>(query: string, bindings: readonly SqlValue[]): Promise<T | null>;
  run(query: string, bindings: readonly SqlValue[]): Promise<{ changes: number }>;
}

export type WebhookEventOutcome = 'handled' | 'ignored' | 'permanent_rejection';

export type WebhookEventClaim =
  | {
      state: 'acquired';
      claimToken: string;
      attemptCount: number;
      leaseExpiresAt: string;
    }
  | { state: 'completed'; outcome: string | null }
  | { state: 'busy' };

interface ClaimedRow {
  claim_token: string;
  attempt_count: number;
  lease_expires_at: string;
}

interface ObservedRow {
  status: 'processing' | 'completed' | 'failed';
  outcome: string | null;
}

const CLAIM_SQL = `
INSERT INTO processed_webhook_events (
  event_id,
  event_type,
  status,
  attempt_count,
  claim_token,
  claimed_at,
  lease_expires_at,
  completed_at,
  last_error,
  outcome,
  created_at,
  updated_at
) VALUES (?, ?, 'processing', 1, ?, ?, ?, NULL, NULL, NULL, ?, ?)
ON CONFLICT(event_id) DO UPDATE SET
  event_type = excluded.event_type,
  status = 'processing',
  attempt_count = processed_webhook_events.attempt_count + 1,
  claim_token = excluded.claim_token,
  claimed_at = excluded.claimed_at,
  lease_expires_at = excluded.lease_expires_at,
  completed_at = NULL,
  last_error = NULL,
  outcome = NULL,
  updated_at = excluded.updated_at
WHERE processed_webhook_events.status = 'failed'
   OR (
     processed_webhook_events.status = 'processing'
     AND processed_webhook_events.lease_expires_at <= ?
   )
RETURNING claim_token, attempt_count, lease_expires_at
`;

const READ_SQL = `
SELECT status, outcome
FROM processed_webhook_events
WHERE event_id = ?
`;

function createExecutor(database: D1Database): ProcessedEventsExecutor {
  return {
    first<T>(query: string, bindings: readonly SqlValue[]) {
      return database.prepare(query).bind(...bindings).first<T>();
    },
    async run(query: string, bindings: readonly SqlValue[]) {
      const result = await database.prepare(query).bind(...bindings).run();
      return { changes: result.meta.changes };
    },
  };
}

async function resolveExecutor(
  executor?: ProcessedEventsExecutor
): Promise<ProcessedEventsExecutor> {
  if (executor) return executor;
  const { env } = await getCloudflareContext({ async: true });
  return createExecutor(env.DB);
}

export function createProcessedEventsExecutor(
  database: D1Database
): ProcessedEventsExecutor {
  return createExecutor(database);
}

export async function claimWebhookEvent(
  input: {
    eventId: string;
    eventType: string;
    now?: Date;
    leaseDurationMs?: number;
    claimToken?: string;
  },
  providedExecutor?: ProcessedEventsExecutor
): Promise<WebhookEventClaim> {
  const executor = await resolveExecutor(providedExecutor);
  const now = input.now ?? new Date();
  const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_MS;
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
    throw new Error('Webhook lease duration must be a positive integer');
  }

  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
  const claimToken = input.claimToken ?? crypto.randomUUID();
  const claimed = await executor.first<ClaimedRow>(CLAIM_SQL, [
    input.eventId,
    input.eventType,
    claimToken,
    nowIso,
    leaseExpiresAt,
    nowIso,
    nowIso,
    nowIso,
  ]);

  if (claimed) {
    return {
      state: 'acquired',
      claimToken: claimed.claim_token,
      attemptCount: claimed.attempt_count,
      leaseExpiresAt: claimed.lease_expires_at,
    };
  }

  const observed = await executor.first<ObservedRow>(READ_SQL, [input.eventId]);
  if (observed?.status === 'completed') {
    return { state: 'completed', outcome: observed.outcome };
  }
  return { state: 'busy' };
}

export async function completeWebhookEvent(
  input: {
    eventId: string;
    claimToken: string;
    outcome: WebhookEventOutcome;
    now?: Date;
  },
  providedExecutor?: ProcessedEventsExecutor
): Promise<boolean> {
  const executor = await resolveExecutor(providedExecutor);
  const nowIso = (input.now ?? new Date()).toISOString();
  const result = await executor.run(`
UPDATE processed_webhook_events
SET status = 'completed',
    claim_token = NULL,
    lease_expires_at = NULL,
    completed_at = ?,
    last_error = NULL,
    outcome = ?,
    updated_at = ?
WHERE event_id = ?
  AND status = 'processing'
  AND claim_token = ?
`, [nowIso, input.outcome, nowIso, input.eventId, input.claimToken]);
  return result.changes === 1;
}

export async function failWebhookEvent(
  input: {
    eventId: string;
    claimToken: string;
    error: unknown;
    now?: Date;
  },
  providedExecutor?: ProcessedEventsExecutor
): Promise<boolean> {
  const executor = await resolveExecutor(providedExecutor);
  const nowIso = (input.now ?? new Date()).toISOString();
  const message = (input.error instanceof Error ? input.error.message : String(input.error))
    .slice(0, MAX_ERROR_LENGTH);
  const result = await executor.run(`
UPDATE processed_webhook_events
SET status = 'failed',
    claim_token = NULL,
    lease_expires_at = NULL,
    last_error = ?,
    updated_at = ?
WHERE event_id = ?
  AND status = 'processing'
  AND claim_token = ?
`, [message, nowIso, input.eventId, input.claimToken]);
  return result.changes === 1;
}

export async function cleanupCompletedWebhookEvents(
  completedBefore: Date,
  providedExecutor?: ProcessedEventsExecutor
): Promise<number> {
  const executor = await resolveExecutor(providedExecutor);
  const result = await executor.run(`
DELETE FROM processed_webhook_events
WHERE status = 'completed'
  AND completed_at < ?
`, [completedBefore.toISOString()]);
  return result.changes;
}
