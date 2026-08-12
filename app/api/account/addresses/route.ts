import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getCustomer } from "@/lib/models/mach/customer";
import { getOrCreateCustomer, mutateCustomerAddresses } from "@/lib/account/customer";
import { assertBoundedRequest, MAX_SAVED_ADDRESSES, parseAddressInput } from "@/lib/account/validation";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const customer = await getCustomer(userId);
  return NextResponse.json({ addresses: customer?.addresses ?? [] });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  try {
    assertBoundedRequest(request);
    const parsed = parseAddressInput(await request.json() as Record<string, unknown>);
    await getOrCreateCustomer(userId);
    const address = { ...parsed, id: `addr_${crypto.randomUUID()}` };
    const customer = await mutateCustomerAddresses(userId, (addresses) => {
      if (addresses.length >= MAX_SAVED_ADDRESSES) throw new Error("Address limit reached");
      const makeDefault = address.is_default || addresses.length === 0;
      return [
        ...addresses.map((entry) => makeDefault ? { ...entry, is_default: false } : entry),
        { ...address, is_default: makeDefault },
      ];
    });
    return NextResponse.json({
      address: customer.addresses?.find((entry) => entry.id === address.id),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address could not be saved";
    const status = message.includes("concurrently") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
