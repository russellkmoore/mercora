"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Order, Review } from "@/lib/types";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Money } from "@/lib/money";
import type { ShipmentView } from "@/lib/fulfillment/shipment-view";
import Link from "next/link";

export type OrderCardOrder = Pick<
  Order,
  "id" | "status" | "total_amount" | "items" | "created_at" | "shipped_at" | "delivered_at"
>;

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

export default function OrderCard({
  order,
  shipment,
}: {
  order: OrderCardOrder;
  shipment: ShipmentView;
}) {
  const date = formatOrderDate(order.created_at || "");
  const total = Money.fromStored(order.total_amount).format();
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.length;
  const previewItem = items?.[0]?.product_name || "Item";
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const statusColor =
    {
      pending: "bg-warning text-foreground",
      processing: "bg-info text-foreground",
      shipped: "bg-info text-foreground",
      delivered: "bg-success text-foreground",
      cancelled: "bg-danger text-foreground",
      refunded: "bg-danger text-foreground",
    }[order.status as OrderStatus] ?? "bg-surface-elevated text-foreground";

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
    <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow sm:p-6">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="truncate text-base font-bold text-primary sm:text-lg">
          Order ID: <span className="text-foreground">{order.id}</span>
        </h3>
        <span className={cn("self-start rounded-full px-2 py-1 text-xs sm:self-center", statusColor)}>
          {order.status}
        </span>
      </div>

      <div className="mb-1 text-sm text-muted-foreground">Placed on {date}</div>

      <div className="mb-1 text-sm text-muted-foreground">
        {itemCount} item{itemCount !== 1 ? "s" : ""}{" "}
        {previewItem && (
          <>
            – <span className="italic">{previewItem}</span>
          </>
        )}
      </div>

      <div className="mt-2 text-lg font-semibold text-foreground">
        Total: <span className="text-success">{total}</span>
      </div>

      {order.shipped_at && (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
          <p className="font-semibold text-foreground">Shipment</p>
          <dl className="mt-2 space-y-1 text-muted-foreground">
            {shipment.carrierLabel && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Carrier</dt>
                <dd>{shipment.carrierLabel}</dd>
              </div>
            )}
            {shipment.trackingNumber && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tracking number</dt>
                <dd className="break-all font-mono">{shipment.trackingNumber}</dd>
              </div>
            )}
          </dl>
          {shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex font-medium text-primary underline hover:text-primary/90"
            >
              Track your package
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {orderId && (
          <Link href={`/account/orders/${encodeURIComponent(orderId)}`} className="text-sm font-medium text-primary hover:text-primary/90">
            View order details
          </Link>
        )}
        {!reviewable && (
          <p className="text-xs text-warning">
            Delivery pending – we’ll invite you to review items once your order arrives.
          </p>
        )}
        {reviewError && <p className="text-xs text-danger">{reviewError}</p>}
        {submittedReviewCount > 0 && (
          <p className="text-xs text-success">
            {submittedReviewCount} review{submittedReviewCount === 1 ? "" : "s"} submitted for this order.
          </p>
        )}
      </div>

      {itemCount > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary/90"
            aria-expanded={expanded}
          >
            <span>{expanded ? "Hide order items" : "Review items from this order"}</span>
            <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="mt-4 space-y-4">
              {items.map((item, index) => {
                const itemKey = item.id ?? item.product_id ?? `${orderId}-${index}`;
                const review = reviews[itemKey] ?? (item.product_id ? reviews[item.product_id] : undefined);
                return (
                  <div key={itemKey} className="rounded-lg border border-border bg-surface p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">SKU {item.sku}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
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
                      <p className="text-xs text-warning">
                        Reviews unlock once delivery is confirmed for this order.
                      </p>
                    )}
                  </div>
                );
              })}
              {loadingReviews && <p className="text-xs text-muted-foreground">Checking existing reviews…</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
