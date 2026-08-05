import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Address } from "@/lib/types";
import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import { getSettings } from "@/lib/utils/settings";
import { Money, cartSubtotal } from "@/lib/money";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  isBoundedString,
  isPlainRecord,
  isValidPublicCartItems,
} from "@/lib/public-request-validation";
import {
  allowedShippingCountries,
  enabledShippingMethods,
  freeShippingMethodIds,
  freeShippingThreshold,
} from '@/lib/shipping/allowed-countries';

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(
      "PUBLIC_RATE_LIMITER",
      `shipping-options:${getClientIp(req)}`
    );
    if (limited) return limited;

    const body: unknown = await req.json();
    if (!isPlainRecord(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { address, items } = body as unknown as { address: Address; items: CartItem[] };

    if (
      !isPlainRecord(address) ||
      !isBoundedString(address.postal_code, 32) ||
      !isBoundedString(address.country, 2) ||
      !/^[A-Za-z]{2}$/.test(address.country)
    ) {
      return NextResponse.json(
        { error: "Missing address data" },
        { status: 400 }
      );
    }

    if (!isValidPublicCartItems(items)) {
      return NextResponse.json({ error: "Cart items are missing or invalid" }, { status: 400 });
    }

    // Load shipping settings before destination policy enforcement so this
    // estimator and authoritative checkout share the same allowlist.
    const shippingSettings = await getSettings('shipping');
    const destinationCountry = address.country.toUpperCase();
    if (!allowedShippingCountries(shippingSettings).includes(destinationCountry)) {
      return NextResponse.json(
        { error: "Shipping options are not available for this destination" },
        { status: 400 }
      );
    }

    // Load shipping settings from database
    const storeSettings = await getSettings('store');
    
    // Get configured shipping methods
    const enabledMethods = enabledShippingMethods(shippingSettings);

    // Calculate order total to check for free shipping
    const orderTotal = cartSubtotal(items);

    const threshold = freeShippingThreshold(storeSettings);
    const freeShippingMethods = freeShippingMethodIds(shippingSettings);

    // Apply free shipping logic if order meets threshold
    const shippingOptions: ShippingOption[] = enabledMethods.map((method: any) => ({
      id: method.id,
      label: method.label,
      cost: (orderTotal.gte(Money.fromMajor(threshold)) && freeShippingMethods.includes(method.id))
        ? Money.zero(orderTotal.currency).toJSON()
        : Money.fromMajor(method.cost, orderTotal.currency).toJSON(),
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
