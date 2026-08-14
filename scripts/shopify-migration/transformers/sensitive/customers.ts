import type { MACHAddress } from "../../../../lib/types/mach/Address.js";
import type { ShopifyCustomer, ShopifyCustomerAddress } from "../../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  isoTimestamp,
  requiredMigrationTime,
} from "../_shared.js";
import {
  MAX_ADDRESSES,
  assertBatchSize,
  boundedTags,
  boundedText,
  emailFingerprint,
  normalizedEmail,
  type SensitiveTransformResult,
  sourceId,
} from "./_shared.js";

export interface CustomerInsertRecord {
  id: string;
  type: "person";
  status: "active" | "pending_verification";
  external_references: string;
  created_at: string;
  updated_at: string;
  person: string;
  addresses: string | null;
  communication_preferences: string;
  tags: string | null;
  extensions: string;
}

export interface CustomerTransformRecord {
  sourceFingerprint: string;
  emailFingerprint: string;
  customer: CustomerInsertRecord;
}

export interface CustomerTransformOptions {
  generatedAt: string;
}

export interface CustomerTransformResult
  extends SensitiveTransformResult<CustomerTransformRecord> {
  emailIdMap: Map<string, string>;
}

function countryCode(address: ShopifyCustomerAddress): string | null {
  const value = address.country_code ?? address.country;
  const normalized = boundedText(value, 2)?.toUpperCase() ?? null;
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function customerAddress(
  address: ShopifyCustomerAddress,
  customerSourceId: string,
  position: number,
): { id: string; type: "shipping" | "other"; address: MACHAddress; is_default: boolean; verification_status: "unverified" } | null {
  const line1 = boundedText(address.address1, 300);
  const city = boundedText(address.city, 200);
  const country = countryCode(address);
  if (!line1 || !city || !country) return null;
  const firstName = boundedText(address.first_name, 100);
  const lastName = boundedText(address.last_name, 100);
  const recipient = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  const providerAddressId = address.id === undefined
    ? `${customerSourceId}:position:${position}`
    : `${customerSourceId}:address:${sourceId(address.id)}`;
  return {
    id: deterministicProviderId(SHOPIFY_PROVIDER, "customer_address", providerAddressId),
    type: address.default ? "shipping" : "other",
    is_default: address.default === true,
    verification_status: "unverified",
    address: {
      line1,
      city,
      country,
      status: "unverified",
      ...(boundedText(address.address2, 300) ? { line2: boundedText(address.address2, 300)! } : {}),
      ...(boundedText(address.province ?? address.province_code, 200)
        ? { region: boundedText(address.province ?? address.province_code, 200)! }
        : {}),
      ...(boundedText(address.zip, 32) ? { postal_code: boundedText(address.zip, 32)! } : {}),
      ...(boundedText(address.company, 200) ? { company: boundedText(address.company, 200)! } : {}),
      ...(boundedText(address.phone, 50) ? { phone: boundedText(address.phone, 50)! } : {}),
      ...(recipient ? { recipient } : {}),
    },
  };
}

export function transformCustomers(
  customers: readonly ShopifyCustomer[],
  options: CustomerTransformOptions,
): CustomerTransformResult {
  assertBatchSize(customers.length);
  const generatedAt = requiredMigrationTime(options.generatedAt);
  const records: CustomerTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const emailIdMap = new Map<string, string>();
  const skipped: Array<{ sourceFingerprint: string | null; reason: string }> = [];
  const warnings: string[] = [];
  const seenSources = new Set<string>();
  const seenEmails = new Set<string>();

  for (const customer of customers) {
    let failedFingerprint: string | null = null;
    try {
      const providerId = sourceId(customer.id);
      const sourceFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "customer", providerId);
      failedFingerprint = sourceFingerprint;
      const email = normalizedEmail(customer.email, true)!;
      if (seenSources.has(sourceFingerprint)) throw new TypeError("Duplicate customer source identity");
      if (seenEmails.has(email)) throw new TypeError("Duplicate normalized customer email");

      const id = deterministicProviderId(SHOPIFY_PROVIDER, "customer", providerId);
      const sourceAddresses = customer.addresses ?? (customer.default_address ? [customer.default_address] : []);
      if (sourceAddresses.length > MAX_ADDRESSES) throw new RangeError("Customer has too many addresses");
      const addresses = sourceAddresses.flatMap((address, position) => {
        try {
          const transformed = customerAddress(address, providerId, position + 1);
          if (!transformed) {
            warnings.push(`Customer ${sourceFingerprint} has an incomplete address; address omitted`);
            return [];
          }
          return [transformed];
        } catch {
          warnings.push(`Customer ${sourceFingerprint} has an invalid address; address omitted`);
          return [];
        }
      });
      let defaultSeen = false;
      const normalizedAddresses = addresses.map((address) => {
        const isDefault = address.is_default && !defaultSeen;
        if (isDefault) defaultSeen = true;
        return { ...address, is_default: isDefault };
      });
      const tags = boundedTags(customer.tags);
      const createdAt = isoTimestamp(customer.created_at, generatedAt);
      const updatedAt = isoTimestamp(customer.updated_at, createdAt);
      const firstName = boundedText(customer.first_name, 100);
      const lastName = boundedText(customer.last_name, 100);
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
      const emailKey = emailFingerprint(email);

      records.push({
        sourceFingerprint,
        emailFingerprint: emailKey,
        customer: {
          id,
          type: "person",
          status: customer.verified_email === true ? "active" : "pending_verification",
          external_references: JSON.stringify({ shopify_fingerprint: sourceFingerprint }),
          created_at: createdAt,
          updated_at: updatedAt,
          person: JSON.stringify({
            email,
            ...(firstName ? { first_name: firstName } : {}),
            ...(lastName ? { last_name: lastName } : {}),
            ...(fullName ? { full_name: fullName } : {}),
            ...(boundedText(customer.phone, 50) ? { phone: boundedText(customer.phone, 50)! } : {}),
          }),
          addresses: normalizedAddresses.length ? JSON.stringify(normalizedAddresses) : null,
          communication_preferences: JSON.stringify({
            email: {
              opted_in: customer.accepts_marketing === true,
              verified: customer.verified_email === true,
            },
          }),
          tags: tags.length ? JSON.stringify(tags) : null,
          extensions: JSON.stringify({
            migration: {
              provider: SHOPIFY_PROVIDER,
              imported: true,
              generated_at: generatedAt,
              source_fingerprint: sourceFingerprint,
            },
            source_summary: {
              orders_count: Number.isSafeInteger(customer.orders_count) && (customer.orders_count ?? -1) >= 0
                ? customer.orders_count
                : null,
            },
          }),
        },
      });
      seenSources.add(sourceFingerprint);
      seenEmails.add(email);
      idMap.set(sourceFingerprint, id);
      emailIdMap.set(emailKey, id);
    } catch (error) {
      skipped.push({
        sourceFingerprint: failedFingerprint,
        reason: error instanceof Error ? error.message : "Customer is invalid",
      });
    }
  }

  return { records, idMap, emailIdMap, skipped, warnings };
}
