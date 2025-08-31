import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Address } from "@/lib/types";
import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import { getSettings } from "@/lib/utils/settings";

export async function POST(req: NextRequest) {
  try {
    const { address, items }: { address: Address; items: CartItem[] } =
      await req.json();

    if (!address || !address.postal_code) {
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

    // Load shipping settings from database
    const shippingSettings = await getSettings('shipping');
    const storeSettings = await getSettings('store');
    
    // Get configured shipping methods
    let shippingMethods = shippingSettings['shipping.methods'] || [
      { id: 'standard', label: 'Standard (5–7 days)', cost: 5.99, estimatedDays: 5, enabled: true },
      { id: 'express', label: 'Express (2–3 days)', cost: 9.99, estimatedDays: 2, enabled: true },
      { id: 'overnight', label: 'Overnight', cost: 19.99, estimatedDays: 1, enabled: true }
    ];

    // Filter to only enabled methods
    const enabledMethods = shippingMethods.filter((method: any) => method.enabled);

    // Calculate order total to check for free shipping
    const orderTotal = items.reduce((total: number, item: CartItem) => {
      return total + (item.price * item.quantity);
    }, 0);

    const freeShippingThreshold = storeSettings['store.free_shipping_threshold'] || 75;
    const freeShippingMethods = shippingSettings['shipping.free_methods'] || ['standard'];

    // Apply free shipping logic if order meets threshold
    const shippingOptions: ShippingOption[] = enabledMethods.map((method: any) => ({
      id: method.id,
      label: method.label,
      cost: (orderTotal >= freeShippingThreshold && freeShippingMethods.includes(method.id)) 
        ? 0 
        : method.cost,
      estimatedDays: method.estimatedDays,
    }));

    return NextResponse.json({ options: shippingOptions });

  } catch (error) {
    console.error('Error fetching shipping options:', error);
    return NextResponse.json(
      { error: "Failed to load shipping options" },
      { status: 500 }
    );
  }
}
