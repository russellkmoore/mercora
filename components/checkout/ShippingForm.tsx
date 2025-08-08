"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Address } from "@/lib/types";

interface ShippingFormProps {
  address: Address;
  email: string; // Email is separate from MACH address
  onChange: (address: Address, email?: string) => void;
  onSelectCountry: (value: string) => void;
  onSubmit: (address: Address, email: string) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export default function ShippingForm({
  address,
  email,
  onChange,
  onSelectCountry,
  onSubmit,
  error,
  disabled = false,
}: ShippingFormProps) {
  const isSubmitDisabled =
    disabled ||
    !(
      address.firstName &&
      address.lastName &&
      email &&
      address.address1 &&
      address.city &&
      address.province &&
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={address.firstName}
              onChange={(e) =>
                onChange({ ...address, firstName: e.target.value })
              }
              disabled={disabled}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={address.lastName}
              onChange={(e) =>
                onChange({ ...address, lastName: e.target.value })
              }
              disabled={disabled}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onChange({ ...address }, e.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address1">Address</Label>
          <Input
            id="address1"
            value={address.address1}
            onChange={(e) =>
              onChange({ ...address, address1: e.target.value })
            }
            disabled={disabled}
            required
          />
        </div>
        <Input
          name="address2"
          placeholder="Apartment, suite, etc. (optional)"
          value={address.address2 || ""}
          onChange={(e) =>
            onChange({ ...address, address2: e.target.value })
          }
          disabled={disabled}
        />
        <div className="flex gap-2">
          <Input
            name="city"
            placeholder="City"
            className="flex-[2]"
            value={address.city}
            onChange={(e) =>
              onChange({ ...address, city: e.target.value })
            }
            disabled={disabled}
            required
          />
          <Input
            name="province"
            placeholder="State/Province"
            className="flex-1"
            value={address.province}
            onChange={(e) =>
              onChange({ ...address, province: e.target.value })
            }
            disabled={disabled}
            required
          />
          <Input
            name="zip"
            placeholder="ZIP Code"
            className="flex-1"
            value={address.zip}
            onChange={(e) => onChange({ ...address, zip: e.target.value })}
            disabled={disabled}
            required
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
              onClick={() => onSubmit(address, email)}
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
