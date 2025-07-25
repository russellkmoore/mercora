import { NextRequest, NextResponse } from "next/server";
import type { Address } from "@/lib/types/address";
import type { BillingInfo } from "@/lib/types/billing";
import type { CartItem } from "@/lib/types/cartitem";
import type { ShippingOption } from "@/lib/types/shipping";
import { insertOrder } from "@/lib/models/order";
import { auth, currentUser } from "@clerk/nextjs/server";

interface OrderRequest {
  items: CartItem[];
  shippingAddress: Address;
  billingInfo: BillingInfo;
  shippingOption: ShippingOption;
  taxAmount: number;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  try {
    const body = (await req.json()) as OrderRequest;

    if (
      !body.items?.length ||
      !body.shippingAddress ||
      !body.billingInfo ||
      !body.shippingOption ||
      typeof body.taxAmount !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing order data" },
        { status: 400 }
      );
    }

    const total =
      body.items.reduce((sum, item) => sum + item.price * item.quantity, 0) +
      body.taxAmount +
      (body.shippingOption.cost || 0);

    const now = Date.now();
    let baseId = userId ?? "guest";

    // If it's an email, take the part before the @
    if (baseId.includes("@")) {
      baseId = baseId.split("@")[0];
    }
    // Remove non-alphanumeric characters and make uppercase
    const safeUserId = baseId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const webOrderId = `WEB-${safeUserId}-${now}`;

    const order = await insertOrder({
      id: webOrderId,
      items: body.items,
      shippingAddress: body.shippingAddress,
      billingAddress: body.shippingAddress, // Assume billing address same as shipping for now
      billingInfo: body.billingInfo,
      shippingOption: body.shippingOption,
      shippingCost: body.shippingOption.cost || 0,
      taxAmount: Math.round(body.taxAmount * 100),
      total: Math.round(total * 100),
      status: "pending",
      userId: userId ?? "guest",
      email: body.shippingAddress.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Order submission failed:", err);
    return NextResponse.json(
      { error: "Failed to submit order" },
      { status: 500 }
    );
  }
}
