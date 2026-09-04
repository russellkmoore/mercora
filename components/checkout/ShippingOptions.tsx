"use client";

import { ShippingOption } from "@/lib/types/shipping";
import { Address } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/lib/money";

interface Props {
  address: Partial<Address>;
  options: ShippingOption[];
  selectedOptionId?: string;
  onSelect: (option: ShippingOption) => void;
  disabled?: boolean;
}

export default function ShippingOptions({
  address,
  options,
  selectedOptionId,
  onSelect,
  disabled = false,
}: Props) {
  return (
    <div
      className={cn(
        "bg-surface-elevated text-foreground p-6 rounded-xl transition-opacity",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>

      <div className="space-y-4">
        {options.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No shipping options available.
          </p>
        )}

        {options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <div
              key={option.id}
              onClick={() => !disabled && onSelect(option)}
              className={cn(
                "border p-4 rounded-md cursor-pointer flex justify-between items-center transition-all",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "hover:border-primary/60"
              )}
            >
              <div>
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-sm text-muted-foreground">
                  {Money.fromStored(option.cost).format()} – Estimated {option.estimatedDays}{" "}
                  days
                </div>
              </div>
              {isSelected && (
                <CheckCircle2 className="text-primary w-6 h-6" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
