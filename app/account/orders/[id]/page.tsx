import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getOrderByCustomerAndId } from "@/lib/models/mach/orders";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import { Money } from "@/lib/money";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await params;
  if (id.length > 128) notFound();
  const order = await getOrderByCustomerAndId(userId!, id);
  if (!order) notFound();
  const shipment = buildShipmentView(order);
  const address = order.shipping_address;
  return <div><Link href="/account/orders" className="text-sm text-orange-400">← Back to orders</Link><div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Order {order.id}</h1><span className="rounded-full bg-neutral-800 px-3 py-1 text-sm capitalize">{order.status}</span></div>{order.shipped_at && <section className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-5"><h2 className="font-semibold">Shipment</h2><p className="mt-2 text-sm text-gray-300">{shipment.carrierLabel ?? "Carrier pending"}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}</p>{shipment.trackingUrl && <a className="mt-3 inline-block text-sm text-orange-400" href={shipment.trackingUrl} rel="noreferrer noopener" target="_blank">Track package</a>}</section>}<section className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-5"><h2 className="font-semibold">Items</h2><ul className="mt-3 divide-y divide-neutral-700">{order.items.map((item, index) => <li key={item.id ?? `${item.product_id}-${index}`} className="flex justify-between gap-4 py-3"><span>{item.product_name} × {item.quantity}</span><span>{Money.fromStored(item.total_price).format()}</span></li>)}</ul><div className="mt-4 flex justify-between border-t border-neutral-600 pt-4 font-semibold"><span>Total</span><span>{Money.fromStored(order.total_amount).format()}</span></div></section>{address && <section className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-5"><h2 className="font-semibold">Shipping address</h2><p className="mt-2 whitespace-pre-line text-sm text-gray-300">{[address.recipient, address.line1, address.line2, `${address.city}, ${address.region ?? ""} ${address.postal_code ?? ""}`, address.country].filter(Boolean).join("\n")}</p></section>}</div>;
}
