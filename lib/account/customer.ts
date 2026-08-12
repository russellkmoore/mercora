import { and, eq, isNull } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { customers, deserializeCustomer } from "@/lib/db/schema/customer";
import { createCustomer, getCustomer } from "@/lib/models/mach/customer";
import type { MACHCustomer, MACHCustomerAddress } from "@/lib/types/mach/Customer";

const MAX_CAS_ATTEMPTS = 4;

export class CustomerWriteConflictError extends Error {
  constructor() {
    super("Customer data changed concurrently");
  }
}

/** Lazily and idempotently provision the authenticated Clerk identity. */
export async function getOrCreateCustomer(userId: string): Promise<MACHCustomer> {
  const existing = await getCustomer(userId);
  if (existing) return existing;

  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const email = user?.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)
    ?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("Authenticated account has no email address");

  try {
    return await createCustomer({
      id: userId,
      type: "person",
      person: {
        email,
        first_name: user?.firstName ?? undefined,
        last_name: user?.lastName ?? undefined,
        full_name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined,
      },
    });
  } catch (error) {
    const winner = await getCustomer(userId);
    if (winner) return winner;
    throw error;
  }
}

function nextVersion(previous: string | null): string {
  const prior = previous ? Date.parse(previous) : 0;
  return new Date(Math.max(Date.now(), Number.isFinite(prior) ? prior + 1 : 0)).toISOString();
}

/**
 * Owner-keyed compare-and-swap for the JSON address collection. D1 serializes
 * each conditional UPDATE, while the version predicate prevents a stale read
 * from overwriting a concurrent edit. Bounded retries rebuild from the winner.
 */
export async function mutateCustomerAddresses(
  customerId: string,
  mutate: (addresses: MACHCustomerAddress[]) => MACHCustomerAddress[],
  database?: Awaited<ReturnType<typeof getDbAsync>>,
): Promise<MACHCustomer> {
  const db = database ?? await getDbAsync();
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const [record] = await db.select().from(customers)
      .where(eq(customers.id, customerId)).limit(1);
    if (!record) throw new Error("Customer not found");

    const customer = deserializeCustomer(record);
    const nextAddresses = mutate(structuredClone(customer.addresses ?? []));
    const updatedAt = nextVersion(record.updatedAt);
    const versionPredicate = record.updatedAt === null
      ? isNull(customers.updatedAt)
      : eq(customers.updatedAt, record.updatedAt);
    const [updated] = await db.update(customers).set({
      addresses: JSON.stringify(nextAddresses),
      updatedAt,
    }).where(and(eq(customers.id, customerId), versionPredicate)).returning();

    if (updated) return deserializeCustomer(updated);
  }
  throw new CustomerWriteConflictError();
}

export async function updateCustomerProfile(
  customerId: string,
  profile: { firstName: string; lastName: string },
  database?: Awaited<ReturnType<typeof getDbAsync>>,
): Promise<MACHCustomer> {
  const db = database ?? await getDbAsync();
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const [record] = await db.select().from(customers)
      .where(eq(customers.id, customerId)).limit(1);
    if (!record) throw new Error("Customer not found");
    const customer = deserializeCustomer(record);
    if (customer.type !== "person" || !customer.person?.email) {
      throw new Error("Customer profile is not editable");
    }
    const updatedAt = nextVersion(record.updatedAt);
    const versionPredicate = record.updatedAt === null
      ? isNull(customers.updatedAt)
      : eq(customers.updatedAt, record.updatedAt);
    const [updated] = await db.update(customers).set({
      person: JSON.stringify({
        ...customer.person,
        first_name: profile.firstName || undefined,
        last_name: profile.lastName || undefined,
        full_name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || undefined,
      }),
      updatedAt,
    }).where(and(eq(customers.id, customerId), versionPredicate)).returning();
    if (updated) return deserializeCustomer(updated);
  }
  throw new CustomerWriteConflictError();
}
