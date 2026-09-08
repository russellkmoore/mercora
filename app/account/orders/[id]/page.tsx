import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrderByCustomerAndId } from "@/lib/models/mach/orders";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import { Money } from "@/lib/money";
import GiftCardRecipientBlock from "@/components/gift-cards/GiftCardRecipientBlock";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/account/orders");
  const { id } = await params;
  if (id.length > 128) notFound();
  const order = await getOrderByCustomerAndId(userId, id);
  if (!order) notFound();
  const shipment = buildShipmentView(order);
  const address = order.shipping_address;
  return <div><Link href="/account/orders" className="text-sm text-primary">← Back to orders</Link><div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold font-display">Order {order.id}</h1><span className="rounded-full bg-surface-elevated px-3 py-1 text-sm capitalize">{order.status}</span></div>{order.shipped_at && <section className="mt-6 rounded-lg border border-border bg-surface-elevated p-5"><h2 className="font-semibold">Shipment</h2><p className="mt-2 text-sm text-muted-foreground">{shipment.carrierLabel ?? "Carrier pending"}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}</p>{shipment.trackingUrl && <a className="mt-3 inline-block text-sm text-primary" href={shipment.trackingUrl} rel="noreferrer noopener" target="_blank">Track package</a>}</section>}<section className="mt-6 rounded-lg border border-border bg-surface-elevated p-5"><h2 className="font-semibold">Items</h2><ul className="mt-3 divide-y divide-border">{order.items.map((item, index) => <li key={item.id ?? `${item.product_id}-${index}`} className={item.gift_card ? "flex flex-col gap-1 py-3" : "py-3"}><div className="flex justify-between gap-4"><span>{item.product_name} × {item.quantity}</span><span>{Money.fromStored(item.total_price).format()}</span></div>{item.gift_card && <GiftCardRecipientBlock customization={item.gift_card} variant="detail" />}</li>)}</ul><div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold"><span>Total</span><span>{Money.fromStored(order.total_amount).format()}</span></div></section>{address && <section className="mt-6 rounded-lg border border-border bg-surface-elevated p-5"><h2 className="font-semibold">Shipping address</h2><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{[address.recipient, address.line1, address.line2, `${address.city}, ${address.region ?? ""} ${address.postal_code ?? ""}`, address.country].filter(Boolean).join("\n")}</p></section>}</div>;
}
