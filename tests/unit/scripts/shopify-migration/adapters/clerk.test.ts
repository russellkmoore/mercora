import { describe, expect, it, vi } from "vitest";
import {
  provisionClerkCustomers,
  type ClerkMigrationClient,
  type ClerkMigrationUser,
} from "@/scripts/shopify-migration/adapters/clerk";
import type { ExecutionPlan } from "@/scripts/shopify-migration/lib/config";
import { transformCustomers } from "@/scripts/shopify-migration/transformers/sensitive/customers";

const VERIFIED_USER: ClerkMigrationUser = {
  id: "user_abcdefgh12345678",
  externalId: null,
};

function execution(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    dryRun: false,
    apply: true,
    target: "local",
    includeSensitive: true,
    overwrite: false,
    confirmedSensitiveData: true,
    confirmedPreview: false,
    confirmedProduction: false,
    confirmedOverwrite: false,
    createClerkUsers: true,
    confirmedClerkAutoVerification: true,
    ...overrides,
  };
}

function plan(verifiedEmail = true) {
  return transformCustomers([{
    id: 42,
    email: "Customer@Example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    verified_email: verifiedEmail,
    accepts_marketing: false,
    created_at: "2020-01-02T03:04:05Z",
    updated_at: "2020-01-03T03:04:05Z",
  }], { generatedAt: "2026-01-01T00:00:00Z" }).records[0];
}

function mockClient(options: {
  external?: readonly ClerkMigrationUser[];
  email?: readonly ClerkMigrationUser[];
  created?: ClerkMigrationUser;
} = {}) {
  const getUserList = vi.fn(async (params: {
    externalId?: readonly string[];
    emailAddress?: readonly string[];
    limit: number;
  }) => ({ data: params.externalId ? (options.external ?? []) : (options.email ?? []) }));
  const createUser = vi.fn(async (params: {
    emailAddress: readonly [string];
    firstName?: string;
    lastName?: string;
    externalId: string;
    skipLegalChecks: true;
  }) => options.created ?? { ...VERIFIED_USER, externalId: params.externalId });
  return {
    client: { users: { getUserList, createUser } } satisfies ClerkMigrationClient,
    getUserList,
    createUser,
  };
}

describe("Clerk migration adapter", () => {
  it("rejects dry runs before touching the injected client", async () => {
    const mocked = mockClient();
    await expect(provisionClerkCustomers(
      [plan()],
      execution({ dryRun: true, apply: false, createClerkUsers: false, confirmedClerkAutoVerification: false }),
      mocked.client,
    )).rejects.toThrow("disabled during dry runs");
    expect(mocked.getUserList).not.toHaveBeenCalled();
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed sensitive access before touching the client", async () => {
    const mocked = mockClient();
    await expect(provisionClerkCustomers(
      [plan()],
      execution({ includeSensitive: false, confirmedSensitiveData: false }),
      mocked.client,
    )).rejects.toThrow("confirmed sensitive-data access");
    expect(mocked.getUserList).not.toHaveBeenCalled();
  });

  it("maps only an exact external fingerprint to a valid Clerk user ID", async () => {
    const customer = plan();
    const mocked = mockClient({
      external: [{ ...VERIFIED_USER, externalId: customer.sourceFingerprint }],
    });
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.idMap).toEqual(new Map([[customer.sourceFingerprint, VERIFIED_USER.id]]));
    expect(result).toMatchObject({ created: 0, existing: 1, reconciliation: [] });
    expect(mocked.getUserList).toHaveBeenCalledOnce();
    expect(mocked.getUserList).toHaveBeenCalledWith({
      externalId: [customer.sourceFingerprint],
      limit: 2,
    });
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("never links by email and sends an existing email owner to reconciliation", async () => {
    const customer = plan();
    const mocked = mockClient({ email: [VERIFIED_USER] });
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.idMap.size).toBe(0);
    expect(result.reconciliation).toEqual([{
      sourceFingerprint: customer.sourceFingerprint,
      reason: "email-conflict",
    }]);
    expect(mocked.getUserList).toHaveBeenNthCalledWith(2, {
      emailAddress: ["customer@example.com"],
      limit: 2,
    });
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("creates only a source-verified identity with the minimal explicitly authorized payload", async () => {
    const customer = plan();
    const mocked = mockClient();
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.idMap).toEqual(new Map([[customer.sourceFingerprint, VERIFIED_USER.id]]));
    expect(result).toMatchObject({ created: 1, existing: 0, reconciliation: [] });
    expect(mocked.createUser).toHaveBeenCalledWith({
      emailAddress: ["customer@example.com"],
      firstName: "Ada",
      lastName: "Lovelace",
      externalId: customer.sourceFingerprint,
      skipLegalChecks: true,
    });
    expect(mocked.createUser.mock.calls[0][0]).not.toHaveProperty("password");
    expect(mocked.createUser.mock.calls[0][0]).not.toHaveProperty("notify");
    expect(mocked.createUser.mock.calls[0][0]).not.toHaveProperty("sendInvite");
  });

  it("does not create identities for unverified source email", async () => {
    const customer = plan(false);
    const mocked = mockClient();
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.idMap.size).toBe(0);
    expect(result.reconciliation[0]).toEqual({
      sourceFingerprint: customer.sourceFingerprint,
      reason: "source-email-unverified",
    });
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("requires the independent creation flag after safe identity lookups", async () => {
    const customer = plan();
    const mocked = mockClient();
    const result = await provisionClerkCustomers(
      [customer],
      execution({ createClerkUsers: false, confirmedClerkAutoVerification: false }),
      mocked.client,
    );

    expect(result.reconciliation[0].reason).toBe("creation-not-authorized");
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("returns stable redacted failure reasons instead of provider messages", async () => {
    const customer = plan();
    const mocked = mockClient();
    mocked.getUserList.mockRejectedValueOnce(new Error("Customer@Example.com secret payload"));
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.reconciliation).toEqual([{
      sourceFingerprint: customer.sourceFingerprint,
      reason: "provider-request-failed",
    }]);
    expect(JSON.stringify(result)).not.toContain("Customer@Example.com");
    expect(JSON.stringify(result)).not.toContain("secret payload");
  });

  it("rejects invalid or ambiguous provider identities without creating users", async () => {
    const customer = plan();
    const ambiguous = mockClient({
      external: [
        { ...VERIFIED_USER, externalId: customer.sourceFingerprint },
        { id: "user_zyxwvuts87654321", externalId: customer.sourceFingerprint },
      ],
    });
    const badCreated = mockClient({
      created: { id: "not-a-clerk-user", externalId: customer.sourceFingerprint },
    });

    const ambiguousResult = await provisionClerkCustomers([customer], execution(), ambiguous.client);
    const createdResult = await provisionClerkCustomers([customer], execution(), badCreated.client);
    expect(ambiguousResult.reconciliation[0].reason).toBe("external-identity-ambiguous");
    expect(ambiguous.createUser).not.toHaveBeenCalled();
    expect(createdResult.reconciliation[0].reason).toBe("created-identity-invalid");
    expect(createdResult.idMap.size).toBe(0);
  });

  it("rejects malformed or duplicate fingerprints before any provider access", async () => {
    const customer = plan();
    const mocked = mockClient();
    await expect(provisionClerkCustomers(
      [{ ...customer, sourceFingerprint: "customer@example.com" }],
      execution(),
      mocked.client,
    )).rejects.toThrow("invalid source fingerprint");
    await expect(provisionClerkCustomers(
      [customer, customer],
      execution(),
      mocked.client,
    )).rejects.toThrow("duplicate source fingerprint");
    expect(mocked.getUserList).not.toHaveBeenCalled();
    expect(mocked.createUser).not.toHaveBeenCalled();
  });

  it("does not create when an external-ID query returns a non-matching identity", async () => {
    const customer = plan();
    const mocked = mockClient({
      external: [{ ...VERIFIED_USER, externalId: "0".repeat(64) }],
    });
    const result = await provisionClerkCustomers([customer], execution(), mocked.client);

    expect(result.reconciliation[0].reason).toBe("external-identity-invalid");
    expect(mocked.getUserList).toHaveBeenCalledOnce();
    expect(mocked.createUser).not.toHaveBeenCalled();
  });
});
