"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/stores/cart-store";
import ProgressBar from "./ProgressBar";
import ShippingOptions from "./ShippingOptions";
import OrderSummary from "./OrderSummary";
import BillingForm from "./BillingForm";
import ShippingForm from "./ShippingForm";
import OrderConfirmationModal from "./OrderConfirmationModal";
import type { ShippingOption, Address } from "@/lib/types";

type ShippingOptionsResponse = { options: ShippingOption[] };
type ShippingOptionsError = { error: string };
type TaxResponse = { amount: number };
type TaxError = { error: string };
type OrderResponse = { orderId: string };
type OrderError = { error: string };

export default function CheckoutClient(userId: any) {
  const {
    items,
    setShippingAddress,
    setShippingOption,
    setBillingInfo,
    setTaxAmount,
    clearCart,
    updateShippingDiscounts,
    shippingAddress,
    shippingOption,
    billingInfo,
    taxAmount,
  } = useCartStore();

  const [step, setStep] = useState<number>(0);
  const [address, setAddress] = useState<Partial<Address>>({
    recipient: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    country: "",
  });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>("");

  function handleAddressChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  }

  async function handleUseAddress() {
    try {
      const res = await fetch("/api/shipping-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, items }),
      });

      if (!res.ok) {
        const err = (await res.json()) as ShippingOptionsError;
        throw new Error(err.error || "Failed to get shipping options");
      }

      const data = (await res.json()) as ShippingOptionsResponse;
      setShippingOptions(data.options);
      setShippingOption(undefined);
      setShippingError(null);
      setShippingAddress({
        recipient: address.recipient || "",
        email: address.email || "",
        line1: address.line1 || "",
        line2: address.line2,
        city: address.city || "",
        region: address.region || "",
        postal_code: address.postal_code || "",
        country: address.country || "",
        type: "shipping",
        status: "unverified",
      } as Address);
      setStep(1);
    } catch (err) {
      if (err instanceof Error) setShippingError(err.message);
      else setShippingError("An unknown error occurred.");
    }
  }

  async function handleShippingSelected(option: ShippingOption) {
    setShippingOption(option);
    // Update shipping discounts when shipping option changes
    updateShippingDiscounts();
    setStep(2);
    try {
      const res = await fetch("/api/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = (await res.json()) as TaxError;
        throw new Error(err.error || "Failed to calculate tax");
      }

      const data = (await res.json()) as TaxResponse;
      const amount = typeof data.amount === "number" ? data.amount : 0;
      setTaxAmount(amount);
    } catch (err) {
      if (err instanceof Error) setOrderError(err.message);
      else setOrderError("Failed to calculate tax.");
    }
  }

  async function handleSubmitOrder(billing: any) {
    try {
      setBillingInfo(billing);
      setOrderError(null);

      const res = await fetch("/api/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingAddress,
          shippingOption,
          billingInfo: billing,
          taxAmount,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as OrderError;
        throw new Error(err.error || "Failed to submit order");
      }

      const data = (await res.json()) as OrderResponse;
      setOrderId(data.orderId);
      setConfirmationOpen(true);
      clearCart();
    } catch (err) {
      if (err instanceof Error) setOrderError(err.message);
      else setOrderError("An unknown error occurred.");
    }
  }

  return (
    <div className="space-y-8">
      <ProgressBar step={step} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <ShippingForm
            address={address}
            onChange={handleAddressChange}
            onSelectCountry={(value) =>
              setAddress((prev) => ({ ...prev, country: value }))
            }
            onSubmit={handleUseAddress}
            error={shippingError}
          />
          <ShippingOptions
            address={address}
            options={shippingOptions}
            onSelect={handleShippingSelected}
            selectedOptionId={shippingOption?.id}
            disabled={step < 1}
          />
        </div>

        <div className="space-y-6">
          <OrderSummary
            items={items}
            shippingOption={shippingOption}
            taxAmount={taxAmount ?? 0}
            showDiscountInput={step >= 1}
          />
          <BillingForm
            disabled={step < 2}
            onSubmit={handleSubmitOrder}
            error={orderError}
          />
        </div>
      </div>

      <OrderConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        orderId={orderId}
        userId={userId}
      />
    </div>
  );
}
