"use client";

import { cn } from "@/lib/utils";
import { Order } from "@/lib/types";

type OrderStatus = "pending" | "paid" | "shipped" | "cancelled" | "incomplete";

export default function OrderCard({ order }: { order: Order }) {
  const date = new Date(order.created_at || '').toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const total = (order.total_amount?.amount ?? 0).toFixed(2);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const previewItem = order.items?.[0]?.product_name || "Item";

  const statusColor =
    {
      pending: "bg-yellow-600 text-white",
      paid: "bg-green-600 text-white",
      shipped: "bg-blue-600 text-white",
      cancelled: "bg-red-600 text-white",
      incomplete: "bg-gray-500 text-white",
    }[order.status as OrderStatus] ?? "bg-gray-700 text-white";

  return (
    <div className="bg-neutral-800 rounded-lg p-4 sm:p-6 shadow border border-neutral-700">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
        <h3 className="text-base sm:text-lg font-bold text-orange-400 truncate">
          Order ID: <span className="text-white">{order.id}</span>
        </h3>
        <span className={cn("text-xs px-2 py-1 rounded-full self-start sm:self-center", statusColor)}>
          {order.status}
        </span>
      </div>

      <div className="text-sm text-gray-400 mb-1">Placed on {date}</div>

      <div className="text-sm text-gray-300 mb-1">
        {itemCount} item{itemCount !== 1 ? "s" : ""}{" "}
        {previewItem && (
          <>
            – <span className="italic">{previewItem}</span>
          </>
        )}
      </div>

      <div className="text-lg font-semibold text-white mt-2">
        Total: <span className="text-green-400">${total}</span>
      </div>
    </div>
  );
}
