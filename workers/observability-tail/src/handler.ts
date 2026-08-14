import type { AlertCooldown, CooldownReservation } from './alert-cooldown';
import {
  buildEmailMessage,
  extractCriticalAlerts,
  MAX_ALERTS_PER_EMAIL,
  safeInternalLog,
  validateAlertConfiguration,
  type CriticalAlert,
} from './core';
import { sendAlertEmail } from './email';

export interface ReservedAlert {
  alert: CriticalAlert;
  reservation: CooldownReservation;
  shortenAfterFailure(now: number, failureBackoffMs: number): Promise<void>;
}

export type ReservationAttempt =
  | { outcome: 'reserved'; value: ReservedAlert }
  | { outcome: 'suppressed' }
  | { outcome: 'failed' };

export interface TailProcessingDependencies {
  reserve?: typeof reserveAlert;
  send?: typeof sendAlertEmail;
  deliveryNow?: () => number;
}

async function reserveAlert(
  alert: CriticalAlert,
  env: ObservabilityTailEnv,
  now: number,
  cooldownMs: number,
): Promise<ReservationAttempt> {
  try {
    const stub = env.ALERT_COOLDOWN.get(env.ALERT_COOLDOWN.idFromName(alert.bucket));
    const reservation = await stub.reserve(now, cooldownMs);
    if (!reservation) return { outcome: 'suppressed' };
    return {
      outcome: 'reserved',
      value: {
        alert,
        reservation,
        async shortenAfterFailure(failureNow, failureBackoffMs): Promise<void> {
          await stub.shortenAfterFailure(
            reservation.reservedUntil,
            failureNow,
            failureBackoffMs,
          );
        },
      },
    };
  } catch (error) {
    safeInternalLog('cooldown_reservation_failed', error);
    return { outcome: 'failed' };
  }
}

async function shortenReservationsAfterFailure(
  reservations: readonly ReservedAlert[],
  now: number,
  failureBackoffMs: number,
): Promise<void> {
  await Promise.all(reservations.map(async (reservation) => {
    try {
      await reservation.shortenAfterFailure(now, failureBackoffMs);
    } catch (error) {
      safeInternalLog('cooldown_failure_backoff_failed', error);
    }
  }));
}

export async function processTailEvents(
  events: readonly unknown[],
  env: ObservabilityTailEnv,
  now = Date.now(),
  dependencies: TailProcessingDependencies = {},
): Promise<void> {
  try {
    const extracted = extractCriticalAlerts(events);
    if (extracted.alerts.length === 0) return;
    const config = validateAlertConfiguration(env);
    if (!config) {
      safeInternalLog('alert_configuration_invalid');
      return;
    }
    const reserve = dependencies.reserve ?? reserveAlert;
    const reservations: ReservedAlert[] = [];
    let boundedOverflow = extracted.overflow;
    for (let index = 0; index < extracted.alerts.length; index += 1) {
      if (reservations.length >= MAX_ALERTS_PER_EMAIL) {
        boundedOverflow += extracted.alerts.length - index;
        break;
      }
      const attempt = await reserve(extracted.alerts[index], env, now, config.cooldownMs);
      if (attempt.outcome === 'reserved') reservations.push(attempt.value);
      if (attempt.outcome === 'failed') boundedOverflow += 1;
    }
    if (reservations.length === 0) return;
    const message = buildEmailMessage(
      reservations.map(({ alert }) => alert),
      boundedOverflow,
      config,
    );
    if (!message) {
      safeInternalLog('alert_message_invalid');
      await shortenReservationsAfterFailure(reservations, now, config.failureBackoffMs);
      return;
    }
    try {
      await (dependencies.send ?? sendAlertEmail)(message, config, env);
    } catch (error) {
      safeInternalLog('alert_delivery_failed', error);
      await shortenReservationsAfterFailure(
        reservations,
        dependencies.deliveryNow?.() ?? Date.now(),
        config.failureBackoffMs,
      );
    }
  } catch (error) {
    safeInternalLog('tail_processing_failed', error);
  }
}
