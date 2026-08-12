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

interface ReservedAlert {
  alert: CriticalAlert;
  reservation: CooldownReservation;
  stub: DurableObjectStub<AlertCooldown>;
}

async function reserveAlert(
  alert: CriticalAlert,
  env: ObservabilityTailEnv,
  now: number,
  cooldownMs: number,
): Promise<ReservedAlert | null> {
  try {
    const stub = env.ALERT_COOLDOWN.get(env.ALERT_COOLDOWN.idFromName(alert.bucket));
    const reservation = await stub.reserve(now, cooldownMs);
    return reservation ? { alert, reservation, stub } : null;
  } catch (error) {
    safeInternalLog('cooldown_reservation_failed', error);
    return null;
  }
}

async function shortenReservationsAfterFailure(
  reservations: readonly ReservedAlert[],
  now: number,
  failureBackoffMs: number,
): Promise<void> {
  await Promise.all(reservations.map(async ({ reservation, stub }) => {
    try {
      await stub.shortenAfterFailure(reservation.reservedUntil, now, failureBackoffMs);
    } catch (error) {
      safeInternalLog('cooldown_failure_backoff_failed', error);
    }
  }));
}

export async function processTailEvents(
  events: readonly unknown[],
  env: ObservabilityTailEnv,
  now = Date.now(),
): Promise<void> {
  try {
    const extracted = extractCriticalAlerts(events);
    if (extracted.alerts.length === 0) return;
    const config = validateAlertConfiguration(env);
    if (!config) {
      safeInternalLog('alert_configuration_invalid');
      return;
    }
    const candidates = extracted.alerts.slice(0, MAX_ALERTS_PER_EMAIL);
    const boundedOverflow = extracted.overflow + extracted.alerts.length - candidates.length;
    const reservations = (await Promise.all(candidates.map((alert) =>
      reserveAlert(alert, env, now, config.cooldownMs))))
      .filter((value): value is ReservedAlert => value !== null);
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
      await sendAlertEmail(message, config, env);
    } catch (error) {
      safeInternalLog('alert_delivery_failed', error);
      await shortenReservationsAfterFailure(reservations, Date.now(), config.failureBackoffMs);
    }
  } catch (error) {
    safeInternalLog('tail_processing_failed', error);
  }
}
