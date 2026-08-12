import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/auth/same-origin";
import { getCustomer } from "@/lib/models/mach/customer";
import { getOrCreateCustomer, updateCustomerProfile } from "@/lib/account/customer";
import { assertBoundedRequest, parseProfileInput } from "@/lib/account/validation";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const customer = await getCustomer(userId);
  return NextResponse.json({ settings: customer ? {
    first_name: customer.person?.first_name ?? "",
    last_name: customer.person?.last_name ?? "",
  } : null });
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  try {
    assertBoundedRequest(request);
    const profile = parseProfileInput(await request.json() as Record<string, unknown>);
    await getOrCreateCustomer(userId);
    await updateCustomerProfile(userId, profile);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings could not be saved";
    return NextResponse.json({ error: message }, { status: message.includes("concurrently") ? 409 : 400 });
  }
}
