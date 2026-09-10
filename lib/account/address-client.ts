import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";

export type AddressFormState = {
  label: string;
  type: "shipping" | "billing";
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export const emptyAddressForm: AddressFormState = {
  label: "",
  type: "shipping",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "US",
  is_default: false,
};

export function addressFormFrom(value: MACHCustomerAddress): AddressFormState {
  return {
    label: value.label ?? "",
    type: value.type === "billing" ? "billing" : "shipping",
    line1: String(value.address.line1 ?? ""),
    line2: String(value.address.line2 ?? ""),
    city: String(value.address.city ?? ""),
    region: value.address.region ?? "",
    postal_code: value.address.postal_code ?? "",
    country: value.address.country,
    is_default: value.is_default === true,
  };
}

export async function saveAddress(
  form: AddressFormState,
  addressId?: string,
): Promise<{ address: MACHCustomerAddress }> {
  const response = await fetch(
    addressId ? `/api/account/addresses/${addressId}` : "/api/account/addresses",
    {
      method: addressId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(form),
    },
  );
  const body = (await response.json()) as { address?: MACHCustomerAddress; error?: string };
  if (!response.ok || !body.address) {
    throw new Error(body.error || "Address could not be saved");
  }
  return { address: body.address };
}
