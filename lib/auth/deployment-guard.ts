/**
 * Deployment posture guard for the admin auth layer.
 *
 * A deployed Worker running a development build must never open the
 * dev-only admin bypasses. This module owns the detection predicate and the
 * only `recordTelemetry` call site for the resulting event, kept out of
 * `admin-middleware.ts`/`unified-auth.ts` because those files already carry
 * raw-exception console logging in their catch blocks, which the
 * observability AST contract test forbids alongside a `recordTelemetry`
 * call in the same file.
 */

import { recordTelemetry } from '@/lib/observability/telemetry';

/** Fixed HTTP status returned when a deployed build is running in development mode. */
export const DEPLOYMENT_GUARD_STATUS = 503;

/** Fixed denial text. Names no environment variable, build mode, or runtime value. */
export const DEPLOYMENT_GUARD_MESSAGE = 'Service temporarily unavailable.';

export type DeploymentPosture =
  | { tripped: true; status: typeof DEPLOYMENT_GUARD_STATUS; message: string }
  | { tripped: false };

/**
 * True only when the Cloudflare Workers runtime is serving a development
 * build. Local development (`next dev`, vitest) never matches because
 * `navigator.userAgent` there is not exactly `Cloudflare-Workers`.
 */
export function isDeployedDevelopmentBuild(): boolean {
  try {
    return (
      typeof navigator === 'object' &&
      navigator !== null &&
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent === 'Cloudflare-Workers' &&
      process.env.NODE_ENV === 'development'
    );
  } catch {
    return false;
  }
}

/**
 * Evaluate deployment posture. When tripped, emits one low-cardinality
 * telemetry event and returns a fixed denial; callers must return this
 * verdict before evaluating any dev-only bypass.
 */
export function assertDeploymentPosture(): DeploymentPosture {
  if (!isDeployedDevelopmentBuild()) return { tripped: false };
  recordTelemetry('auth.deployment_guard_tripped', { outcome: 'unavailable' });
  return {
    tripped: true,
    status: DEPLOYMENT_GUARD_STATUS,
    message: DEPLOYMENT_GUARD_MESSAGE,
  };
}
