import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { mutateCustomerAddresses } from "@/lib/account/customer";
import { assertBoundedRequest, parseAddressInput } from "@/lib/account/validation";

function denial() {
  return NextResponse.json({ error: "Address not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  const { id } = await context.params;
  if (!id || id.length > 80) return denial();
  try {
    assertBoundedRequest(request);
    const input = parseAddressInput(await request.json() as Record<string, unknown>);
    let found = false;
    const customer = await mutateCustomerAddresses(userId, (addresses) => {
      found = addresses.some((entry) => entry.id === id);
      if (!found) return addresses;
      return addresses.map((entry) => {
        if (entry.id === id) return { ...input, id };
        return input.is_default ? { ...entry, is_default: false } : entry;
      });
    });
    if (!found) return denial();
    return NextResponse.json({ address: customer.addresses?.find((entry) => entry.id === id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address could not be saved";
    return NextResponse.json({ error: message }, { status: message.includes("concurrently") ? 409 : 400 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  const { id } = await context.params;
  if (!id || id.length > 80) return denial();
  try {
    let found = false;
    await mutateCustomerAddresses(userId, (addresses) => {
      const removed = addresses.find((entry) => entry.id === id);
      if (!removed) return addresses;
      found = true;
      const remaining = addresses.filter((entry) => entry.id !== id);
      if (removed.is_default && remaining.length && !remaining.some((entry) => entry.is_default)) {
        remaining[0] = { ...remaining[0], is_default: true };
      }
      return remaining;
    });
    if (!found) return denial();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address could not be removed";
    return NextResponse.json({ error: message }, { status: message.includes("concurrently") ? 409 : 400 });
  }
}
