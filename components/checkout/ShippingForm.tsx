"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Address } from "@/lib/types/address";

interface Props {
  address: Address;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectCountry: (value: string) => void;
  onSubmit: (address: Address) => void;
  error?: string | null;
  disabled?: boolean;
}

export default function ShippingForm({
  address,
  onChange,
  onSelectCountry,
  onSubmit,
  error,
  disabled = false,
}: Props) {
  const isSubmitDisabled =
    disabled ||
    !(
      address.name &&
      address.email &&
      address.address &&
      address.city &&
      address.state &&
      address.zip &&
      address.country
    );

  return (
    <div
      className={`bg-white text-black p-6 rounded-xl transition-opacity ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>

      <div className="space-y-4">
        <Input
          name="name"
          placeholder="Full Name"
          value={address.name}
          onChange={onChange}
        />
        <Input
          name="email"
          placeholder="Email"
          value={address.email}
          onChange={onChange}
        />
        <Input
          name="address"
          placeholder="Street Address"
          value={address.address}
          onChange={onChange}
        />
        <Input
          name="address2"
          placeholder="Street Address 2"
          value={address.address2}
          onChange={onChange}
        />
        <div className="flex gap-2">
          <Input
            name="city"
            placeholder="City"
            className="flex-[2]"
            value={address.city}
            onChange={onChange}
          />
          <Input
            name="state"
            placeholder="State"
            className="flex-1"
            value={address.state}
            onChange={onChange}
          />
          <Input
            name="zip"
            placeholder="Zip Code"
            className="flex-1"
            value={address.zip}
            onChange={onChange}
          />
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-[3]">
            <Select onValueChange={onSelectCountry} value={address.country}>
              <SelectTrigger id="country" className="bg-white text-black">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent className="bg-white text-black">
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Button
              onClick={() => onSubmit(address)}
              className="w-full bg-black text-white hover:bg-orange-500"
              disabled={isSubmitDisabled}
            >
              Use Address
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm font-medium mt-2">{error}</div>
        )}
      </div>
    </div>
  );
}
