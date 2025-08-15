"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Address } from "@/lib/types";

type BillingFormProps = {
  disabled: boolean;
  onSubmit: (billing: BillingInfo, sameAsShipping: boolean) => void;
  error?: string | null;
};

export type BillingInfo = {
  name: string;
  cardNumber: string;
  expiration: string;
  cvv: string;
  billingAddress?: Partial<Address>;
};

export default function BillingForm({
  disabled,
  onSubmit,
  error,
}: BillingFormProps) {
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billing, setBilling] = useState<BillingInfo>({
    name: "",
    cardNumber: "",
    expiration: "",
    cvv: "",
    billingAddress: {
      line1: "",
      line2: "",
      city: "",
      region: "",
      postal_code: "",
      country: "",
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('billing_')) {
      const addressField = name.replace('billing_', '') as keyof Address;
      setBilling((prev) => ({
        ...prev,
        billingAddress: {
          ...prev.billingAddress,
          [addressField]: value,
        },
      }));
    } else {
      setBilling((prev) => ({ ...prev, [name]: value }));
    }
  };

  const isComplete =
    billing.name &&
    billing.cardNumber &&
    billing.expiration &&
    billing.cvv &&
    (sameAsShipping ||
      (billing.billingAddress?.line1 &&
        billing.billingAddress?.city &&
        billing.billingAddress?.region &&
        billing.billingAddress?.postal_code &&
        billing.billingAddress?.country));

  const handleSubmit = () => {
    if (!disabled && isComplete) {
      onSubmit(billing, sameAsShipping);
    }
  };

  return (
    <div
      className={`bg-white p-6 rounded-xl transition-opacity text-black ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <h2 className="text-lg font-bold mb-4">Billing Information</h2>

      <div className="space-y-4">
        <Input
          placeholder="Cardholder Name"
          name="name"
          value={billing.name}
          onChange={handleChange}
          disabled={disabled}
        />
        <Input
          placeholder="Card Number"
          name="cardNumber"
          value={billing.cardNumber}
          onChange={handleChange}
          disabled={disabled}
        />
        <div className="flex gap-4">
          <Input
            placeholder="Expiration Date"
            name="expiration"
            value={billing.expiration}
            onChange={handleChange}
            disabled={disabled}
          />
          <Input
            placeholder="CVV"
            name="cvv"
            value={billing.cvv}
            onChange={handleChange}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sameAsShipping"
            checked={sameAsShipping}
            onCheckedChange={(checked) => setSameAsShipping(checked === true)}
            disabled={disabled}
          />
          <label
            htmlFor="sameAsShipping"
            className="text-sm font-medium leading-none"
          >
            Billing address same as shipping
          </label>
        </div>

        {!sameAsShipping && (
          <div className="space-y-4">
            <Input
              placeholder="Billing Address"
              name="billing_line1"
              value={typeof billing.billingAddress?.line1 === 'string' ? billing.billingAddress.line1 : ""}
              onChange={handleChange}
              disabled={disabled}
            />
            <Input
              placeholder="Billing Address 2"
              name="billing_line2"
              value={typeof billing.billingAddress?.line2 === 'string' ? billing.billingAddress.line2 || '' : ""}
              onChange={handleChange}
              disabled={disabled}
            />
            <div className="flex gap-4">
              <Input
                placeholder="City"
                name="billing_city"
                className="w-1/2"
                value={typeof billing.billingAddress?.city === 'string' ? billing.billingAddress.city : ""}
                onChange={handleChange}
                disabled={disabled}
              />
              <Input
                placeholder="State"
                name="billing_region"
                className="w-1/4"
                value={billing.billingAddress?.region || ""}
                onChange={handleChange}
                disabled={disabled}
              />
              <Input
                placeholder="Zip"
                name="billing_postal_code"
                className="w-1/4"
                value={billing.billingAddress?.postal_code || ""}
                onChange={handleChange}
                disabled={disabled}
              />
            </div>
            <Input
              placeholder="Country"
              name="billing_country"
              value={billing.billingAddress?.country || ""}
              onChange={handleChange}
              disabled={disabled}
            />
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm font-medium mt-2">{error}</div>
        )}

        <Button
          className="w-full bg-black text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={disabled || !isComplete}
        >
          Submit Order
        </Button>
      </div>
    </div>
  );
}
