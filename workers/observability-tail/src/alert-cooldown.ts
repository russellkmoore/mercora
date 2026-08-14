import { DurableObject } from 'cloudflare:workers';

const MIN_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 86_400_000;
const MIN_FAILURE_BACKOFF_MS = 10_000;
const MAX_FAILURE_BACKOFF_MS = 300_000;

export interface CooldownReservation {
  reservedUntil: number;
}

function validTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDuration(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export class AlertCooldown extends DurableObject<ObservabilityTailEnv> {
  constructor(ctx: DurableObjectState, env: ObservabilityTailEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS alert_cooldown (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        reserved_until INTEGER NOT NULL
      ) STRICT
    `);
  }

  async reserve(now: number, cooldownMs: number): Promise<CooldownReservation | null> {
    if (!validTimestamp(now) || !validDuration(cooldownMs, MIN_COOLDOWN_MS, MAX_COOLDOWN_MS)) {
      return null;
    }
    const reservedUntil = now + cooldownMs;
    if (!Number.isSafeInteger(reservedUntil)) return null;
    const rows = this.ctx.storage.sql.exec<{ reserved_until: number }>(`
      INSERT INTO alert_cooldown (singleton, reserved_until)
      VALUES (1, ?)
      ON CONFLICT(singleton) DO UPDATE SET reserved_until = excluded.reserved_until
      WHERE alert_cooldown.reserved_until <= ?
      RETURNING reserved_until
    `, reservedUntil, now).toArray();
    if (rows.length !== 1) return null;
    try {
      await this.ctx.storage.setAlarm(reservedUntil);
    } catch {
      // Expiration is checked during reservation; the alarm is only housekeeping.
    }
    return { reservedUntil };
  }

  async shortenAfterFailure(
    expectedReservedUntil: number,
    now: number,
    failureBackoffMs: number,
  ): Promise<void> {
    if (!validTimestamp(expectedReservedUntil) || !validTimestamp(now) ||
      !validDuration(failureBackoffMs, MIN_FAILURE_BACKOFF_MS, MAX_FAILURE_BACKOFF_MS)) {
      return;
    }
    const retryAt = now + failureBackoffMs;
    if (!Number.isSafeInteger(retryAt)) return;
    const update = this.ctx.storage.sql.exec(`
      UPDATE alert_cooldown
      SET reserved_until = ?
      WHERE singleton = 1 AND reserved_until = ? AND reserved_until > ?
    `, retryAt, expectedReservedUntil, retryAt);
    if (update.rowsWritten !== 1) return;
    try {
      await this.ctx.storage.setAlarm(retryAt);
    } catch {
      // Expiration is checked during reservation; the alarm is only housekeeping.
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      'DELETE FROM alert_cooldown WHERE singleton = 1 AND reserved_until <= ?',
      now,
    );
    const next = this.ctx.storage.sql.exec<{ reserved_until: number }>(
      'SELECT reserved_until FROM alert_cooldown WHERE singleton = 1',
    ).toArray()[0];
    if (next && next.reserved_until > now) {
      await this.ctx.storage.setAlarm(next.reserved_until);
    }
  }
}
