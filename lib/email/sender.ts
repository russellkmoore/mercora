import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Resend } from "resend";

export type EmailProvider = "cloudflare" | "resend";

export interface OutboundEmail {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

interface CloudflareEmailAddress {
  name: string;
  email: string;
}

interface CloudflareEmailBinding {
  send(message: Omit<OutboundEmail, "from"> & {
    from: string | CloudflareEmailAddress;
  }): Promise<{ messageId: string }>;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  provider?: EmailProvider;
  pending?: boolean;
  needsReview?: boolean;
  skipped?: boolean;
  error?: string;
  errorCode?: string;
}

interface ResendLike {
  emails: { send(message: OutboundEmail, options?: { idempotencyKey?: string }): Promise<{
    data?: { id?: string } | null;
    error?: { message?: string; name?: string } | null;
  }> };
}

export interface EmailSendOptions {
  idempotencyKey?: string;
  provider?: EmailProvider;
  cloudflareBinding?: CloudflareEmailBinding;
  resendClient?: ResendLike;
  database?: D1Database;
  env?: Record<string, unknown>;
  now?: Date;
}

interface Runtime {
  provider: EmailProvider;
  cloudflare?: CloudflareEmailBinding;
  resend?: ResendLike;
  database?: D1Database;
}

const PROVIDER_CONFIG_ERROR = "E_PROVIDER_CONFIG";
const IDEMPOTENCY_CONFIG_ERROR = "E_IDEMPOTENCY_CONFIG";

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function resolveRuntime(options: EmailSendOptions): Promise<Runtime> {
  let workerEnv = options.env ?? {};
  if (!options.env) {
    try {
      workerEnv = (await getCloudflareContext({ async: true })).env as unknown as Record<string, unknown>;
    } catch {
      workerEnv = {};
    }
  }
  const cloudflare = options.cloudflareBinding ?? workerEnv.EMAIL as CloudflareEmailBinding | undefined;
  const database = options.database ?? workerEnv.DB as D1Database | undefined;
  const resendKey = stringValue(workerEnv.RESEND_API_KEY) ?? stringValue(process.env.RESEND_API_KEY);
  const resend = options.resendClient ?? (resendKey ? new Resend(resendKey) as unknown as ResendLike : undefined);
  const configured = options.provider ?? stringValue(workerEnv.EMAIL_PROVIDER) ?? stringValue(process.env.EMAIL_PROVIDER);
  if (configured && configured !== "cloudflare" && configured !== "resend") {
    throw new Error("EMAIL_PROVIDER must be 'cloudflare' or 'resend'");
  }
  const provider = configured as EmailProvider | undefined;
  if (provider === "cloudflare") {
    if (!cloudflare) throw new Error("EMAIL_PROVIDER=cloudflare requires the EMAIL binding");
    return { provider, cloudflare, database };
  }
  if (provider === "resend") {
    if (!resend) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
    return { provider, resend, database };
  }
  const available = [cloudflare ? "cloudflare" : null, resend ? "resend" : null].filter(Boolean) as EmailProvider[];
  if (available.length !== 1) {
    throw new Error(available.length === 0
      ? "Email is not configured; set EMAIL_PROVIDER and its binding or secret"
      : "Both email providers are configured; set EMAIL_PROVIDER explicitly");
  }
  return { provider: available[0], cloudflare, resend, database };
}

function parseSender(value: string): string | CloudflareEmailAddress {
  const named = value.match(/^([^<>]{1,100})\s*<([^<>]+)>$/);
  return named ? { name: named[1].trim(), email: named[2].trim() } : value;
}

function bounded(value: unknown, fallback: string, max = 2_000): string {
  return (typeof value === "string" ? value : fallback).slice(0, max);
}

const LEASE_MS = 10 * 60 * 1_000;

async function claimDelivery(database: D1Database, key: string, provider: EmailProvider, now: Date) {
  const nowIso = now.toISOString();
  await database.prepare(`INSERT INTO email_deliveries
    (idempotency_key, provider, status, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`
  ).bind(key, provider, nowIso, nowIso).run();
  const token = crypto.randomUUID();
  const claimed = await database.prepare(`UPDATE email_deliveries SET
      provider = ?, status = 'processing', claim_token = ?, lease_expires_at = ?,
      error_code = NULL, last_error = NULL, updated_at = ?
    WHERE idempotency_key = ? AND provider = ? AND (
      status = 'pending' OR status = 'failed' OR
      (? = 'resend' AND status = 'processing' AND lease_expires_at <= ?)
    ) RETURNING claim_token`
  ).bind(provider, token, new Date(now.getTime() + LEASE_MS).toISOString(), nowIso, key, provider, provider, nowIso)
    .first<{ claim_token: string }>();
  if (claimed) return { kind: "claimed" as const, token };
  if (provider === "cloudflare") {
    await database.prepare(`UPDATE email_deliveries SET
        status = 'needs_review', claim_token = NULL, lease_expires_at = NULL,
        error_code = 'E_DELIVERY_INDETERMINATE',
        last_error = 'Cloudflare Email accepted-state is unknown after the delivery lease expired',
        updated_at = ?
      WHERE idempotency_key = ? AND provider = 'cloudflare'
        AND status = 'processing' AND lease_expires_at <= ?`
    ).bind(nowIso, key, nowIso).run();
  }
  const existing = await database.prepare(`SELECT provider, status, provider_message_id
    FROM email_deliveries WHERE idempotency_key = ?`
  ).bind(key).first<{ provider: EmailProvider; status: string; provider_message_id: string | null }>();
  if (existing?.provider !== provider) throw new Error("Idempotency key was claimed by a different email provider");
  if (existing?.status === "succeeded") return { kind: "succeeded" as const, id: existing.provider_message_id ?? undefined };
  if (existing?.status === "needs_review") return { kind: "needs_review" as const };
  return { kind: "pending" as const };
}

async function finishDelivery(database: D1Database, key: string, token: string, result: EmailResult, now: Date) {
  const completed = await database.prepare(`UPDATE email_deliveries SET
      status = ?, claim_token = NULL, lease_expires_at = NULL,
      provider_message_id = ?, error_code = ?, last_error = ?,
      updated_at = ?, completed_at = ?
    WHERE idempotency_key = ? AND status = 'processing' AND claim_token = ?`
  ).bind(
    result.success ? "succeeded" : result.needsReview ? "needs_review" : "failed",
    result.id ?? null,
    result.errorCode ?? null,
    result.error ? bounded(result.error, "Email delivery failed") : null,
    now.toISOString(), result.success ? now.toISOString() : null, key, token,
  ).run();
  if (completed.meta.changes !== 1) {
    throw new Error("Email delivery ownership expired before completion");
  }
}

async function deliver(message: OutboundEmail, runtime: Runtime, idempotencyKey?: string): Promise<EmailResult> {
  if (runtime.provider === "cloudflare") {
    try {
      const response = await runtime.cloudflare!.send({
        ...message,
        from: parseSender(message.from),
      });
      return { success: true, id: response.messageId, provider: "cloudflare" };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? bounded((error as { code?: unknown }).code, "") : undefined;
      return {
        success: false,
        provider: "cloudflare",
        error: bounded(error instanceof Error ? error.message : error, "Cloudflare Email delivery outcome is unknown"),
        ...(code ? { errorCode: code } : { errorCode: "E_DELIVERY_INDETERMINATE", needsReview: true }),
      };
    }
  }
  try {
    const { data, error } = await runtime.resend!.emails.send(message, idempotencyKey ? { idempotencyKey } : undefined);
    if (error) return { success: false, provider: "resend", error: bounded(error.message, "Resend delivery failed"), ...(error.name ? { errorCode: error.name } : {}) };
    return { success: true, provider: "resend", ...(data?.id ? { id: data.id } : {}) };
  } catch (error) {
    return { success: false, provider: "resend", error: bounded(error instanceof Error ? error.message : error, "Resend delivery failed") };
  }
}

/** Selects exactly one provider before sending and never falls back on failure. */
export async function sendEmail(message: OutboundEmail, options: EmailSendOptions = {}): Promise<EmailResult> {
  if (!message.html.trim() || !message.text.trim()) return { success: false, error: "Email requires both HTML and text bodies", errorCode: "E_FIELD_MISSING" };
  let runtime: Runtime;
  try { runtime = await resolveRuntime(options); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : "Email provider configuration failed", errorCode: PROVIDER_CONFIG_ERROR }; }
  const key = options.idempotencyKey?.trim();
  if (options.idempotencyKey !== undefined && !key) {
    return { success: false, provider: runtime.provider, error: "Email idempotency key cannot be empty", errorCode: "E_IDEMPOTENCY_KEY" };
  }
  if (key && runtime.provider === "cloudflare" && !runtime.database) {
    return {
      success: false,
      provider: runtime.provider,
      error: "Cloudflare Email idempotency requires the DB binding",
      errorCode: IDEMPOTENCY_CONFIG_ERROR,
    };
  }
  let claim: Awaited<ReturnType<typeof claimDelivery>> | undefined;
  if (key && runtime.database) {
    if (key.length > 256) return { success: false, provider: runtime.provider, error: "Email idempotency key is too long", errorCode: "E_IDEMPOTENCY_KEY" };
    try { claim = await claimDelivery(runtime.database, key, runtime.provider, options.now ?? new Date()); }
    catch (error) { return { success: false, provider: runtime.provider, error: bounded(error instanceof Error ? error.message : error, "Email idempotency claim failed"), errorCode: "E_IDEMPOTENCY_CLAIM" }; }
    if (claim.kind === "succeeded") return { success: true, provider: runtime.provider, ...(claim.id ? { id: claim.id } : {}) };
    if (claim.kind === "needs_review") return {
      success: false,
      needsReview: true,
      provider: runtime.provider,
      error: "Cloudflare Email delivery outcome is unknown and requires manual reconciliation",
      errorCode: "E_DELIVERY_INDETERMINATE",
    };
    if (claim.kind === "pending") return { success: false, pending: true, provider: runtime.provider, error: "Email delivery is already in progress", errorCode: "concurrent_idempotent_requests" };
  }
  const result = await deliver(message, runtime, key);
  if (key && runtime.database && claim?.kind === "claimed") {
    try { await finishDelivery(runtime.database, key, claim.token, result, options.now ?? new Date()); }
    catch {
      return {
        success: false,
        provider: runtime.provider,
        ...(result.success ? { needsReview: true } : {}),
        error: "Email delivery state could not be recorded",
        errorCode: "E_IDEMPOTENCY_COMPLETE",
      };
    }
  }
  return result;
}
