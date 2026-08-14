import { describe, expect, it } from "vitest";
import type { ShopifyCustomer, ShopifyCustomerAddress } from "@/scripts/shopify-migration/lib/types";
import {
  materializeCustomers,
  transformCustomers,
} from "@/scripts/shopify-migration/transformers/sensitive/customers";

const generatedAt = "2026-08-14T12:00:00.000Z";

function address(overrides: Partial<ShopifyCustomerAddress> = {}): ShopifyCustomerAddress {
  return {
    id: "address-source-private",
    first_name: "Example",
    last_name: "Recipient",
    address1: "1 Example Way",
    address2: "Unit 2",
    city: "Example City",
    province_code: "EX",
    country_code: "US",
    zip: "00000",
    default: true,
    ...overrides,
  };
}

function customer(overrides: Partial<ShopifyCustomer> = {}): ShopifyCustomer {
  return {
    id: "customer-source-private",
    email: "person@example.invalid",
    first_name: "Example",
    last_name: "Person",
    verified_email: true,
    accepts_marketing: false,
    tags: "Member, Example, member",
    orders_count: 2,
    addresses: [address()],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-02-01T00:00:00Z",
    ...overrides,
  };
}

describe("sensitive customer transform", () => {
  it("is deterministic and emits current snake-case person and nested address shapes", () => {
    const first = transformCustomers([customer()], { generatedAt });
    const second = transformCustomers([customer()], { generatedAt });
    expect(first).toEqual(second);
    expect(first.skipped).toEqual([]);

    const transformed = first.records[0];
    expect(transformed).not.toHaveProperty("id");
    expect(transformed).not.toHaveProperty("customer");
    expect(transformed.provisioningReference).toMatch(/^shopify_customer_provisioning_[a-f0-9]{24}$/);
    const materialized = materializeCustomers(first.records, new Map([
      [transformed.sourceFingerprint, "user_1234567890"],
    ]));
    const record = materialized.records[0];
    expect(record.id).toBe("user_1234567890");
    expect(record.status).toBe("active");
    expect(JSON.parse(record.person)).toEqual({
      email: "person@example.invalid",
      first_name: "Example",
      last_name: "Person",
      full_name: "Example Person",
    });
    expect(JSON.parse(record.person)).not.toHaveProperty("firstName");
    expect(JSON.parse(record.addresses!)).toEqual([expect.objectContaining({
      id: expect.stringMatching(/^shopify_customer_address_/),
      type: "shipping",
      is_default: true,
      verification_status: "unverified",
      address: expect.objectContaining({
        line1: "1 Example Way",
        line2: "Unit 2",
        city: "Example City",
        region: "EX",
        postal_code: "00000",
        country: "US",
        recipient: "Example Recipient",
        status: "unverified",
      }),
    })]);
    expect(JSON.parse(record.communication_preferences)).toEqual({
      email: { opted_in: false, verified: true },
    });
    expect(JSON.parse(record.tags!)).toEqual(["Member", "Example"]);
    expect(transformed.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(transformed.emailFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect([...materialized.idMap.values()]).toEqual([record.id]);
    expect([...materialized.emailIdMap.values()]).toEqual([record.id]);
  });

  it("persists provider fingerprints instead of raw provider identifiers", () => {
    const result = transformCustomers([customer()], { generatedAt });
    const serialized = JSON.stringify(result.records[0]);
    expect(serialized).not.toContain("customer-source-private");
    expect(serialized).not.toContain("address-source-private");
    expect(JSON.parse(result.records[0].customerFields.external_references)).toEqual({
      shopify_fingerprint: result.records[0].sourceFingerprint,
    });
  });

  it("keeps unverified identity conservative and omits incomplete addresses", () => {
    const result = transformCustomers([customer({
      verified_email: false,
      addresses: [address({ country_code: undefined, country: "Long country name" })],
    })], { generatedAt });
    expect(result.records[0].customerFields.status).toBe("pending_verification");
    expect(result.records[0].customerFields.addresses).toBeNull();
    expect(result.warnings[0]).toContain("address omitted");
  });

  it("cannot materialize provisional or missing identities as customer primary keys", () => {
    const plans = transformCustomers([customer()], { generatedAt }).records;
    const fingerprint = plans[0].sourceFingerprint;
    const missing = materializeCustomers(plans, new Map());
    const provisional = materializeCustomers(plans, new Map([
      [fingerprint, plans[0].provisioningReference],
    ]));

    expect(missing.records).toEqual([]);
    expect(provisional.records).toEqual([]);
    expect(provisional.skipped[0].reason).toBe("Customer requires a resolved Clerk user ID");
    expect(JSON.stringify(provisional)).not.toContain('"id":"shopify_customer_');
  });

  it("cannot override a resolved Clerk ID through forged insert fields", () => {
    const plans = transformCustomers([customer()], { generatedAt }).records;
    const fingerprint = plans[0].sourceFingerprint;
    const forged = [{
      ...plans[0],
      customerFields: {
        ...plans[0].customerFields,
        id: "shopify_customer_deadbeefdeadbeefdeadbeef",
      },
    }];

    const result = materializeCustomers(forged, new Map([
      [fingerprint, "user_1234567890"],
    ]));
    expect(result.records[0].id).toBe("user_1234567890");
    expect(JSON.stringify(result.records[0])).not.toContain("shopify_customer_deadbeef");
  });

  it("skips invalid, duplicate, and over-bounded sensitive records", () => {
    const duplicateEmail = customer({ id: "another-source" });
    const tooManyAddresses = customer({
      id: "too-many-addresses",
      email: "many@example.invalid",
      addresses: Array.from({ length: 26 }, (_, index) => address({ id: index })),
    });
    const result = transformCustomers([
      customer(),
      duplicateEmail,
      customer({ id: "bad-email", email: "not-an-email" }),
      tooManyAddresses,
    ], { generatedAt });

    expect(result.records).toHaveLength(1);
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      "Duplicate normalized customer email",
      "Email address is invalid",
      "Customer has too many addresses",
    ]);
    expect(result.skipped.every((entry) => !("record" in entry))).toBe(true);
  });
});
