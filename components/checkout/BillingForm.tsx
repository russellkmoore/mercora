"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
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
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBilling((prev) => ({ ...prev, [name]: value }));
  };

  const isComplete =
    billing.name &&
    billing.cardNumber &&
    billing.expiration &&
    billing.cvv &&
    (sameAsShipping ||
      (billing.address &&
        billing.city &&
        billing.state &&
        billing.zip &&
        billing.country));

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
              name="address"
              value={billing.address}
              onChange={handleChange}
              disabled={disabled}
            />
            <Input
              placeholder="Billing Address 2"
              name="address2"
              value={billing.address2}
              onChange={handleChange}
              disabled={disabled}
            />
            <div className="flex gap-4">
              <Input
                placeholder="City"
                name="city"
                className="w-1/2"
                value={billing.city}
                onChange={handleChange}
                disabled={disabled}
              />
              <Input
                placeholder="State"
                name="state"
                className="w-1/4"
                value={billing.state}
                onChange={handleChange}
                disabled={disabled}
              />
              <Input
                placeholder="Zip"
                name="zip"
                className="w-1/4"
                value={billing.zip}
                onChange={handleChange}
                disabled={disabled}
              />
            </div>
            <Input
              placeholder="Country"
              name="country"
              value={billing.country}
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
