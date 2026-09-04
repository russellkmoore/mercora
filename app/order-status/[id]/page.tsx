import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCarrierRegistry } from "@/lib/fulfillment/carrier-config";
import { getOrderById } from "@/lib/models/mach/orders";
import { buildGuestOrderProjection } from "@/lib/order-status/guest-projection";
import { verifyOrderStatusToken } from "@/lib/order-status/token";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStoreConfig } from "@/lib/store-config";

export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** Token-bearing responses must never be cached. */
export const dynamic = "force-dynamic";

function clientIp(requestHeaders: Headers): string {
  const cloudflareIp = requestHeaders.get("CF-Connecting-IP")?.trim();
  if (cloudflareIp) return cloudflareIp.slice(0, 128);
  const forwarded = requestHeaders.get("x-forwarded-for")?.slice(0, 1_024);
  return forwarded?.split(",", 1)[0]?.trim().slice(0, 128) || "unknown";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function GuestOrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [{ id }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const token = typeof query.token === "string" ? query.token : null;
  if (!token) notFound();

  const limited = await enforceRateLimit(
    "PUBLIC_RATE_LIMITER",
    `order-status:${clientIp(requestHeaders)}`,
  );
  if (limited) notFound();

  // Authentication and order binding happen before the first database read.
  if (!(await verifyOrderStatusToken(token, id))) notFound();

  const order = await getOrderById(id);
  if (!order) notFound();

  const store = getStoreConfig();
  const view = buildGuestOrderProjection(order, getCarrierRegistry());

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm text-muted-foreground">{`${store.identity.name} order status`}</p>
        <h1 className="mt-1 break-all text-2xl font-bold text-foreground">
          Order {view.orderNumber}
        </h1>
        {view.placedAt && (
          <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(view.placedAt)}</p>
        )}

        <section className="mt-6 rounded-lg border border-border bg-surface-elevated p-5">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Status</h2>
          <p className="text-lg font-semibold capitalize text-foreground">
            {view.status.replace(/_/g, " ")}
          </p>
        </section>

        {view.shippedAt && (
          <section className="mt-4 rounded-lg border border-border bg-surface-elevated p-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Shipment</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Shipped</dt>
                <dd className="text-foreground">{formatDate(view.shippedAt)}</dd>
              </div>
              {view.carrierLabel && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Carrier</dt>
                  <dd className="text-foreground">{view.carrierLabel}</dd>
                </div>
              )}
              {view.trackingNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tracking number</dt>
                  <dd className="break-all font-mono text-foreground">{view.trackingNumber}</dd>
                </div>
              )}
            </dl>
            {view.trackingUrl && (
              <a
                href={view.trackingUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex text-sm font-medium text-primary underline hover:text-primary/90"
              >
                Track your package
              </a>
            )}
          </section>
        )}

        <section className="mt-4 rounded-lg border border-border bg-surface-elevated p-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Items</h2>
          <ul className="space-y-2">
            {view.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex justify-between gap-4 text-sm">
                <span className="text-foreground">{item.name}</span>
                <span className="text-muted-foreground">Qty: {item.quantity}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-sm text-muted-foreground">
          Questions about this order? Email{" "}
          <a
            href={`mailto:${store.contact.supportEmail}`}
            className="text-primary underline hover:text-primary/90"
          >
            {store.contact.supportEmail}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
