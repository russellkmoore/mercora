import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrdersByCustomer } from "@/lib/models/mach/orders";
import OrderCard, { type OrderCardOrder } from "@/components/OrderCard";
import { getCarrierRegistry } from "@/lib/fulfillment/carrier-config";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";

export default async function AccountOrdersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/account/orders");
  const orders = await getOrdersByCustomer(userId);
  const registry = getCarrierRegistry();
  const cards = orders.map((order) => ({
    order: {
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      items: order.items,
      created_at: order.created_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
    } satisfies OrderCardOrder,
    shipment: buildShipmentView(order, registry),
  }));
  return <div><h1 className="text-3xl font-bold">Order history</h1>{cards.length === 0 ? <p className="mt-6 text-gray-400">You haven&rsquo;t placed any orders yet.</p> : <div className="mt-6 space-y-5">{cards.map(({ order, shipment }) => <OrderCard key={order.id} order={order} shipment={shipment} />)}</div>}</div>;
}
