import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Address } from "@/lib/types/address";
import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";

// Mock options based on country or zip for now
const mockShippingOptions: ShippingOption[] = [
  {
    id: "standard",
    label: "Standard (5–7 days)",
    cost: 5.99,
    estimatedDays: 5,
  },
  { id: "express", label: "Express (2–3 days)", cost: 9.99, estimatedDays: 2 },
  { id: "overnight", label: "Overnight", cost: 19.99, estimatedDays: 1 },
];

export async function POST(req: NextRequest) {
  const { address, items }: { address: Address; items: CartItem[] } =
    await req.json();

  if (!address || !address.zip) {
    return NextResponse.json(
      { error: "Missing address data" },
      { status: 400 }
    );
  }

  if (address.country !== "US") {
    return NextResponse.json(
      { error: "Shipping options only available for US addresses" },
      { status: 400 }
    );
  }

  // In a real app, use zip/country logic to determine available options
  return NextResponse.json({ options: mockShippingOptions });
}
