import type { ExecutionPlan } from "../../lib/config.js";
import type { CustomerProvisioningPlan } from "../../transformers/sensitive/customers.js";
import { safeClerkUserId } from "../../transformers/sensitive/_shared.js";

const MAX_CLERK_RESULTS = 2;
const MAX_CLERK_PLANS = 1_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const MAX_OPERATION_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5_000;
const SAFE_SOURCE_FINGERPRINT = /^[a-f0-9]{64}$/;

export interface ClerkRequestContext {
  signal: AbortSignal;
}

export interface ClerkMigrationUser {
  id: string;
  externalId: string | null;
}

export interface ClerkMigrationClient {
  users: {
    getUserList(params: {
      externalId?: readonly string[];
      emailAddress?: readonly string[];
      limit: number;
    }, context?: ClerkRequestContext): Promise<{ data: readonly ClerkMigrationUser[] }>;
    createUser(params: {
      emailAddress: readonly [string];
      firstName?: string;
      lastName?: string;
      externalId: string;
      skipLegalChecks: true;
    }, context?: ClerkRequestContext): Promise<ClerkMigrationUser>;
  };
}

export interface ClerkRetryDirective {
  retryable: boolean;
  /** Parsed Retry-After duration. Values are capped by the adapter. */
  retryAfterMs?: number;
}

export type ClerkErrorClassifier = (error: unknown) => ClerkRetryDirective;
export type ClerkOperationRunner = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
) => Promise<T>;
export type ClerkRetrySleeper = (delayMs: number) => Promise<void>;

export interface ClerkProvisioningOptions {
  operationTimeoutMs?: number;
  maxAttempts?: number;
  runOperation?: ClerkOperationRunner;
  sleep?: ClerkRetrySleeper;
  classifyError?: ClerkErrorClassifier;
}

/**
 * Narrow error seam for a Clerk SDK wrapper. The wrapper may parse an HTTP
 * Retry-After header, convert it to milliseconds, and throw this redacted
 * error without exposing a provider response or request payload.
 */
export class ClerkRetryableRequestError extends Error {
  constructor(readonly retryAfterMs?: number) {
    super("Clerk migration request may be retried");
    this.name = "ClerkRetryableRequestError";
  }
}

class ClerkOperationTimeoutError extends Error {
  constructor() {
    super("Clerk migration request timed out");
    this.name = "ClerkOperationTimeoutError";
  }
}

export type ClerkReconciliationReason =
  | "external-identity-ambiguous"
  | "external-identity-invalid"
  | "email-conflict"
  | "source-email-unverified"
  | "creation-not-authorized"
  | "provider-request-failed"
  | "created-identity-invalid"
  | "plan-invalid";

export interface ClerkReconciliationItem {
  sourceFingerprint: string;
  reason: ClerkReconciliationReason;
}

export interface ClerkProvisioningResult {
  /** Only source fingerprints mapped to validated final Clerk `user_*` IDs. */
  idMap: Map<string, string>;
  created: number;
  existing: number;
  reconciliation: ClerkReconciliationItem[];
}

interface ProvisioningIdentity {
  email: string;
  firstName?: string;
  lastName?: string;
  sourceVerified: boolean;
}

function assertAuthorizedExecution(execution: ExecutionPlan): void {
  if (execution.dryRun || !execution.apply) {
    throw new Error("Clerk identity resolution is disabled during dry runs");
  }
  if (!execution.includeSensitive || !execution.confirmedSensitiveData) {
    throw new Error("Clerk identity resolution requires confirmed sensitive-data access");
  }
  if (!(["local", "preview", "production"] as const).includes(execution.target)) {
    throw new Error("Clerk identity resolution target is invalid");
  }
  if (execution.target === "preview" && !execution.confirmedPreview) {
    throw new Error("Clerk preview identity resolution requires explicit preview confirmation");
  }
  if (execution.target === "production" && !execution.confirmedProduction) {
    throw new Error("Clerk production identity resolution requires explicit production confirmation");
  }
  if (execution.confirmedPreview && execution.target !== "preview") {
    throw new Error("Clerk preview confirmation does not match the execution target");
  }
  if (execution.confirmedProduction && execution.target !== "production") {
    throw new Error("Clerk production confirmation does not match the execution target");
  }
  if (execution.confirmedClerkAutoVerification && !execution.createClerkUsers) {
    throw new Error("Clerk auto-verification confirmation requires identity creation authorization");
  }
  if (
    execution.createClerkUsers &&
    !execution.confirmedClerkAutoVerification
  ) {
    throw new Error("Clerk identity creation requires explicit auto-verification confirmation");
  }
}

function boundedInteger(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

const defaultRunOperation: ClerkOperationRunner = async (operation, timeoutMs) => {
  const controller = new AbortController();
  return await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      controller.abort();
      settle(() => reject(new ClerkOperationTimeoutError()));
    }, timeoutMs);
    void Promise.resolve().then(() => operation(controller.signal)).then(
      (result) => settle(() => resolve(result)),
      (error: unknown) => settle(() => reject(error)),
    );
  });
};

const defaultSleep: ClerkRetrySleeper = async (delayMs) => {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

const defaultClassifyError: ClerkErrorClassifier = (error) => ({
  retryable: error instanceof ClerkRetryableRequestError || error instanceof ClerkOperationTimeoutError,
  ...(error instanceof ClerkRetryableRequestError && error.retryAfterMs !== undefined
    ? { retryAfterMs: error.retryAfterMs }
    : {}),
});

function retryDelay(directive: ClerkRetryDirective, attempt: number): number {
  const retryAfter = directive.retryAfterMs;
  if (retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(Math.ceil(retryAfter), MAX_RETRY_DELAY_MS);
  }
  return Math.min(BASE_RETRY_DELAY_MS * (2 ** (attempt - 1)), MAX_RETRY_DELAY_MS);
}

async function clerkRequest<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  runtime: Required<ClerkProvisioningOptions>,
): Promise<T> {
  for (let attempt = 1; attempt <= runtime.maxAttempts; attempt += 1) {
    try {
      return await runtime.runOperation(operation, runtime.operationTimeoutMs);
    } catch (error) {
      const directive = runtime.classifyError(error);
      if (!directive.retryable || attempt === runtime.maxAttempts) throw error;
      await runtime.sleep(retryDelay(directive, attempt));
    }
  }
  throw new Error("Clerk migration request failed");
}

function provisioningRuntime(options: ClerkProvisioningOptions): Required<ClerkProvisioningOptions> {
  return {
    operationTimeoutMs: boundedInteger(
      options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS,
      1,
      MAX_OPERATION_TIMEOUT_MS,
      "Clerk operation timeout",
    ),
    maxAttempts: boundedInteger(
      options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      1,
      MAX_ATTEMPTS,
      "Clerk request attempts",
    ),
    runOperation: options.runOperation ?? defaultRunOperation,
    sleep: options.sleep ?? defaultSleep,
    classifyError: options.classifyError ?? defaultClassifyError,
  };
}

function userListData(value: unknown): readonly ClerkMigrationUser[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { data?: unknown }).data)) {
    throw new TypeError("Clerk provider returned an invalid user list");
  }
  const users = (value as { data: unknown[] }).data;
  if (users.length > MAX_CLERK_RESULTS) throw new RangeError("Clerk provider returned too many users");
  if (users.some((user) => {
    if (!user || typeof user !== "object") return true;
    const candidate = user as { id?: unknown; externalId?: unknown };
    return typeof candidate.id !== "string" ||
      (candidate.externalId !== null && typeof candidate.externalId !== "string");
  })) {
    throw new TypeError("Clerk provider returned an invalid user");
  }
  return users as unknown as readonly ClerkMigrationUser[];
}

function parseProvisioningIdentity(plan: CustomerProvisioningPlan): ProvisioningIdentity {
  const person = JSON.parse(plan.customerFields.person) as unknown;
  const preferences = JSON.parse(plan.customerFields.communication_preferences) as unknown;
  if (!person || typeof person !== "object" || Array.isArray(person)) {
    throw new TypeError("Customer identity payload is invalid");
  }
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    throw new TypeError("Customer communication preferences are invalid");
  }

  const personRecord = person as Record<string, unknown>;
  const preferenceRecord = preferences as Record<string, unknown>;
  const emailPreference = preferenceRecord.email;
  const email = personRecord.email;
  if (typeof email !== "string" || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new TypeError("Customer email is invalid");
  }
  if (!emailPreference || typeof emailPreference !== "object" || Array.isArray(emailPreference)) {
    throw new TypeError("Customer email verification state is invalid");
  }

  const firstName = personRecord.first_name;
  const lastName = personRecord.last_name;
  if (firstName !== undefined && (typeof firstName !== "string" || firstName.length > 100)) {
    throw new TypeError("Customer first name is invalid");
  }
  if (lastName !== undefined && (typeof lastName !== "string" || lastName.length > 100)) {
    throw new TypeError("Customer last name is invalid");
  }

  return {
    email,
    ...(typeof firstName === "string" && firstName ? { firstName } : {}),
    ...(typeof lastName === "string" && lastName ? { lastName } : {}),
    sourceVerified:
      plan.customerFields.status === "active" &&
      (emailPreference as Record<string, unknown>).verified === true,
  };
}

function exactExternalUser(
  users: readonly ClerkMigrationUser[],
  sourceFingerprint: string,
): { id: string | null; reason?: ClerkReconciliationReason } {
  const exact = users.filter((user) => user.externalId === sourceFingerprint);
  if (exact.length > 1) return { id: null, reason: "external-identity-ambiguous" };
  if (exact.length === 0) {
    return users.length === 0
      ? { id: null }
      : { id: null, reason: "external-identity-invalid" };
  }
  if (users.length !== 1) return { id: null, reason: "external-identity-ambiguous" };
  const id = safeClerkUserId(exact[0].id);
  return id ? { id } : { id: null, reason: "external-identity-invalid" };
}

function pushReconciliation(
  items: ClerkReconciliationItem[],
  sourceFingerprint: string,
  reason: ClerkReconciliationReason,
): void {
  items.push({ sourceFingerprint, reason });
}

/**
 * Resolve or create Clerk identities for transformed Shopify customers.
 *
 * The caller must never invoke this function for a dry run: the function
 * rejects before touching the injected client. Email lookups detect ownership
 * conflicts only; they are deliberately never used to link an existing user.
 */
export async function provisionClerkCustomers(
  plans: readonly CustomerProvisioningPlan[],
  execution: ExecutionPlan,
  client: ClerkMigrationClient,
  options: ClerkProvisioningOptions = {},
): Promise<ClerkProvisioningResult> {
  assertAuthorizedExecution(execution);
  const runtime = provisioningRuntime(options);
  if (plans.length > MAX_CLERK_PLANS) throw new RangeError("Clerk provisioning batch is too large");
  const sourceFingerprints = new Set<string>();
  for (const plan of plans) {
    if (!SAFE_SOURCE_FINGERPRINT.test(plan.sourceFingerprint)) {
      throw new TypeError("Clerk provisioning plan contains an invalid source fingerprint");
    }
    if (sourceFingerprints.has(plan.sourceFingerprint)) {
      throw new TypeError("Clerk provisioning plan contains a duplicate source fingerprint");
    }
    sourceFingerprints.add(plan.sourceFingerprint);
  }
  const idMap = new Map<string, string>();
  const resolvedUserIds = new Set<string>();
  const reconciliation: ClerkReconciliationItem[] = [];
  let created = 0;
  let existing = 0;

  for (const plan of plans) {
    let identity: ProvisioningIdentity;
    try {
      identity = parseProvisioningIdentity(plan);
    } catch {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "plan-invalid");
      continue;
    }

    let externalUsers: readonly ClerkMigrationUser[];
    try {
      externalUsers = userListData(await clerkRequest(
        (signal) => client.users.getUserList({
          externalId: [plan.sourceFingerprint],
          limit: MAX_CLERK_RESULTS,
        }, { signal }),
        runtime,
      ));
    } catch {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "provider-request-failed");
      continue;
    }

    const resolved = exactExternalUser(externalUsers, plan.sourceFingerprint);
    if (resolved.reason) {
      pushReconciliation(reconciliation, plan.sourceFingerprint, resolved.reason);
      continue;
    }
    if (resolved.id) {
      if (resolvedUserIds.has(resolved.id)) {
        pushReconciliation(reconciliation, plan.sourceFingerprint, "external-identity-ambiguous");
        continue;
      }
      idMap.set(plan.sourceFingerprint, resolved.id);
      resolvedUserIds.add(resolved.id);
      existing += 1;
      continue;
    }

    if (!identity.sourceVerified) {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "source-email-unverified");
      continue;
    }
    if (!execution.createClerkUsers) {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "creation-not-authorized");
      continue;
    }

    let emailUsers: readonly ClerkMigrationUser[];
    try {
      emailUsers = userListData(await clerkRequest(
        (signal) => client.users.getUserList({
          emailAddress: [identity.email],
          limit: MAX_CLERK_RESULTS,
        }, { signal }),
        runtime,
      ));
    } catch {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "provider-request-failed");
      continue;
    }
    if (emailUsers.length > 0) {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "email-conflict");
      continue;
    }

    try {
      const user = await clerkRequest(
        (signal) => client.users.createUser({
          emailAddress: [identity.email],
          ...(identity.firstName ? { firstName: identity.firstName } : {}),
          ...(identity.lastName ? { lastName: identity.lastName } : {}),
          externalId: plan.sourceFingerprint,
          skipLegalChecks: true,
        }, { signal }),
        runtime,
      );
      const userId = user.externalId === plan.sourceFingerprint
        ? safeClerkUserId(user.id)
        : null;
      if (!userId || resolvedUserIds.has(userId)) {
        pushReconciliation(reconciliation, plan.sourceFingerprint, "created-identity-invalid");
        continue;
      }
      idMap.set(plan.sourceFingerprint, userId);
      resolvedUserIds.add(userId);
      created += 1;
    } catch {
      // Provider messages can echo emails or request payloads, so return only
      // a bounded stable reason and let a rerun reconcile by external ID.
      pushReconciliation(reconciliation, plan.sourceFingerprint, "provider-request-failed");
    }
  }

  return { idMap, created, existing, reconciliation };
}
