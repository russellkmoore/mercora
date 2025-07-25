import { auth } from "@clerk/nextjs/server";
import { getOrdersByUserId } from "@/lib/models/order";
import OrderCard from "@/components/OrderCard";

export default async function OrdersPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
        <div className="max-w-6xl mx-auto p-6">
          <h2 className="text-2xl font-bold mb-4">Order History</h2>
          <p className="text-orange-500">
            You must be logged in to view your orders.
          </p>
        </div>
      </main>
    );
  }

  const orders = await getOrdersByUserId(userId);

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Order History</h2>
        {orders.length === 0 ? (
          <p className="text-gray-400">You haven’t placed any orders yet.</p>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
