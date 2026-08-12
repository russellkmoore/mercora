import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getCustomer, getCustomerDisplayName } from "@/lib/models/mach/customer";
import { getOrdersByCustomer } from "@/lib/models/mach/orders";
import { Money } from "@/lib/money";

export default async function AccountPage() {
  const { userId } = await auth();
  const [customer, orders] = await Promise.all([getCustomer(userId!), getOrdersByCustomer(userId!)]);
  const recent = orders.slice(0, 3);
  return <div><h1 className="text-3xl font-bold">Welcome{customer ? `, ${getCustomerDisplayName(customer)}` : ""}</h1><p className="mt-2 text-gray-400">Manage account details and review your order history.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"> <section className="rounded-lg border border-neutral-700 bg-neutral-900 p-5"><h2 className="font-semibold">Recent orders</h2>{recent.length ? <ul className="mt-3 space-y-2 text-sm">{recent.map((order) => <li key={order.id} className="flex justify-between"><Link className="text-orange-400" href={`/account/orders/${encodeURIComponent(order.id!)}`}>{order.id}</Link><span>{Money.fromStored(order.total_amount).format()}</span></li>)}</ul> : <p className="mt-3 text-sm text-gray-400">No orders yet.</p>}<Link href="/account/orders" className="mt-4 inline-block text-sm text-orange-400">View all orders</Link></section><section className="rounded-lg border border-neutral-700 bg-neutral-900 p-5"><h2 className="font-semibold">Saved addresses</h2><p className="mt-3 text-sm text-gray-400">{customer?.addresses?.length ?? 0} saved</p><Link href="/account/addresses" className="mt-4 inline-block text-sm text-orange-400">Manage addresses</Link></section></div></div>;
}
