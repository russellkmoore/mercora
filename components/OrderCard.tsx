"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Order, Review } from "@/lib/types";
import { ReviewForm } from "@/components/reviews/ReviewForm";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

interface OrderReviewsResponse {
  data?: Review[];
}

function formatOrderDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildReviewKey(review: Review) {
  return review.order_item_id ?? review.product_id ?? review.id;
}

export default function OrderCard({ order }: { order: Order }) {
  const date = formatOrderDate(order.created_at || "");
  const totalAmount = order.total_amount?.amount ?? 0;
  const total = (totalAmount / 100).toFixed(2);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.length;
  const previewItem = items?.[0]?.product_name || "Item";
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const statusColor =
    {
      pending: "bg-yellow-600 text-white",
      processing: "bg-blue-600 text-white",
      shipped: "bg-indigo-600 text-white",
      delivered: "bg-green-600 text-white",
      cancelled: "bg-red-600 text-white",
      refunded: "bg-purple-600 text-white",
    }[order.status as OrderStatus] ?? "bg-gray-700 text-white";

  const orderId = order.id ?? "";
  const reviewable =
    order.status === "delivered" ||
    order.status === "refunded" ||
    Boolean(order.delivered_at);
  const disabledReason = reviewable ? null : "Reviews unlock once delivery is confirmed.";

  useEffect(() => {
    if (!orderId || !reviewable) return;
    let cancelled = false;

    async function loadReviews() {
      setLoadingReviews(true);
      setReviewError(null);
      try {
        const response = await fetch(`/api/orders/${orderId}/reviews`);
        if (!response.ok) {
          throw new Error('Unable to load review status.');
        }

        const payload = await response.json() as OrderReviewsResponse;
        if (cancelled) return;

        const incoming: Record<string, Review> = {};
        for (const review of (payload?.data ?? []) as Review[]) {
          const key = buildReviewKey(review);
          incoming[key] = review;
          if (review.product_id) {
            incoming[review.product_id] = review;
          }
        }

        setReviews(incoming);
      } catch (error) {
        if (!cancelled) {
          setReviewError(error instanceof Error ? error.message : 'Unable to load review status.');
        }
      } finally {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [orderId, reviewable]);

  const submittedReviewCount = useMemo(() => {
    const ids = new Set(Object.values(reviews).map((review) => review.id));
    return ids.size;
  }, [reviews]);

  function handleReviewSubmitted(review: Review) {
    const key = buildReviewKey(review);
    setReviews((prev) => ({
      ...prev,
      [key]: review,
      ...(review.product_id ? { [review.product_id]: review } : {}),
    }));
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-4 shadow sm:p-6">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="truncate text-base font-bold text-orange-400 sm:text-lg">
          Order ID: <span className="text-white">{order.id}</span>
        </h3>
        <span className={cn("self-start rounded-full px-2 py-1 text-xs sm:self-center", statusColor)}>
          {order.status}
        </span>
      </div>

      <div className="mb-1 text-sm text-gray-400">Placed on {date}</div>

      <div className="mb-1 text-sm text-gray-300">
        {itemCount} item{itemCount !== 1 ? "s" : ""}{" "}
        {previewItem && (
          <>
            – <span className="italic">{previewItem}</span>
          </>
        )}
      </div>

      <div className="mt-2 text-lg font-semibold text-white">
        Total: <span className="text-green-400">${total}</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!reviewable && (
          <p className="text-xs text-amber-300">
            Delivery pending – we’ll invite you to review items once your gear arrives.
          </p>
        )}
        {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}
        {submittedReviewCount > 0 && (
          <p className="text-xs text-green-300">
            {submittedReviewCount} review{submittedReviewCount === 1 ? "" : "s"} submitted for this order.
          </p>
        )}
      </div>

      {itemCount > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center justify-between rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:border-orange-500 hover:text-orange-300"
            aria-expanded={expanded}
          >
            <span>{expanded ? "Hide order items" : "Review items from this order"}</span>
            <span className="text-xs text-gray-400">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="mt-4 space-y-4">
              {items.map((item, index) => {
                const itemKey = item.id ?? item.product_id ?? `${orderId}-${index}`;
                const review = reviews[itemKey] ?? (item.product_id ? reviews[item.product_id] : undefined);
                return (
                  <div key={itemKey} className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.product_name}</p>
                        <p className="text-xs text-gray-400">SKU {item.sku}</p>
                      </div>
                      <p className="text-xs text-gray-400">Quantity: {item.quantity}</p>
                    </div>
                    {reviewable ? (
                      <ReviewForm
                        orderId={orderId}
                        orderItemId={item.id}
                        productId={item.product_id}
                        productName={item.product_name}
                        existingReview={review}
                        onSubmitted={handleReviewSubmitted}
                        disabledReason={disabledReason}
                        canSubmit={reviewable}
                      />
                    ) : (
                      <p className="text-xs text-amber-300">
                        Reviews unlock once delivery is confirmed for this order.
                      </p>
                    )}
                  </div>
                );
              })}
              {loadingReviews && <p className="text-xs text-gray-400">Checking existing reviews…</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
