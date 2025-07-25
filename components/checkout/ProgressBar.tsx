"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function ProgressBar({ step }: { step: number }) {
  const steps = [
    "Shipping Address",
    "Shipping Method",
    "Billing Information",
    "Order Submitted",
  ];

  const [fillWidths, setFillWidths] = useState<number[]>(steps.map(() => 0));

  useEffect(() => {
    setFillWidths((prev) =>
      prev.map((_, i) => {
        if (i < step) return 100; // previous steps fully filled
        if (i === step) return 100; // animate current step
        return 0; // future steps
      })
    );
  }, [step]);

  return (
    <div className="w-full flex items-center justify-between mb-8">
      {steps.map((label, index) => {
        const isCompleted = index < step;
        const isCurrent = index === step;

        return (
          <div key={index} className="flex-1 flex flex-col items-center relative">
            {/* Circle */}
            <div className="mb-1 h-6 flex items-center justify-center">
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-orange-500" />
              ) : (
                <div
                  className={`w-6 h-6 rounded-full border-2 ${
                    isCurrent ? "bg-orange-500 border-orange-500" : "border-gray-300"
                  }`}
                />
              )}
            </div>

            {/* Bar */}
            <div className="w-full h-1 bg-gray-300 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-1 bg-orange-500 transition-all duration-1000 ease-in-out"
                style={{ width: `${fillWidths[index]}%` }}
              />
            </div>

            {/* Label */}
            <div className="mt-1 text-xs font-semibold text-center">
              <span className={index <= step ? "text-orange-500" : "text-gray-400"}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
