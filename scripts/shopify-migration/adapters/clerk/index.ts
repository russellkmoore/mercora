import type { ExecutionPlan } from "../../lib/config.js";
import type { CustomerProvisioningPlan } from "../../transformers/sensitive/customers.js";
import { safeClerkUserId } from "../../transformers/sensitive/_shared.js";

const MAX_CLERK_RESULTS = 2;
const MAX_CLERK_PLANS = 100_000;
const SAFE_SOURCE_FINGERPRINT = /^[a-f0-9]{64}$/;

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
    }): Promise<{ data: readonly ClerkMigrationUser[] }>;
    createUser(params: {
      emailAddress: readonly [string];
      firstName?: string;
      lastName?: string;
      externalId: string;
      skipLegalChecks: true;
    }): Promise<ClerkMigrationUser>;
  };
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
  if (
    execution.createClerkUsers &&
    !execution.confirmedClerkAutoVerification
  ) {
    throw new Error("Clerk identity creation requires explicit auto-verification confirmation");
  }
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
): Promise<ClerkProvisioningResult> {
  assertAuthorizedExecution(execution);
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
      externalUsers = (await client.users.getUserList({
        externalId: [plan.sourceFingerprint],
        limit: MAX_CLERK_RESULTS,
      })).data;
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

    let emailUsers: readonly ClerkMigrationUser[];
    try {
      emailUsers = (await client.users.getUserList({
        emailAddress: [identity.email],
        limit: MAX_CLERK_RESULTS,
      })).data;
    } catch {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "provider-request-failed");
      continue;
    }
    if (emailUsers.length > 0) {
      pushReconciliation(reconciliation, plan.sourceFingerprint, "email-conflict");
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

    try {
      const user = await client.users.createUser({
        emailAddress: [identity.email],
        ...(identity.firstName ? { firstName: identity.firstName } : {}),
        ...(identity.lastName ? { lastName: identity.lastName } : {}),
        externalId: plan.sourceFingerprint,
        skipLegalChecks: true,
      });
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
