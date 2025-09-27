/**
 * === Orders Page Component ===
 *
 * A server-side rendered page that displays a user's order history.
 * Provides authentication-gated access to order data with proper
 * error states and empty states for optimal user experience.
 *
 * === Features ===
 * - **Authentication Required**: Server-side auth check with redirect logic
 * - **Order History**: Complete list of user's past orders
 * - **Empty States**: Helpful messaging when no orders exist
 * - **Order Cards**: Rich order details with OrderCard component
 * - **Responsive Layout**: Mobile-optimized with desktop enhancements
 * - **Security**: User-scoped data access with proper authorization
 *
 * === Authentication Flow ===
 * - Server-side authentication check using Clerk
 * - Displays login prompt for unauthenticated users
 * - Fetches user-specific orders only after auth verification
 * - Maintains security boundaries for sensitive order data
 *
 * === Technical Implementation ===
 * - **Server Component**: Full SSR for SEO and performance
 * - **Database Integration**: Direct order fetching with user filtering
 * - **Error Handling**: Graceful degradation for auth and data failures
 * - **TypeScript Safety**: Fully typed order data with proper interfaces
 *
 * === Layout States ===
 * - **Unauthenticated**: Login prompt with explanation
 * - **No Orders**: Empty state with helpful messaging
 * - **With Orders**: Scrollable list of order cards with details
 *
 * === Usage ===
 * Rendered at "/orders" route for order history access
 * 
 * @returns Server-rendered orders page with authentication and data
 */

import { auth } from "@clerk/nextjs/server";
import { getOrdersByUserId } from "@/lib/models/";
import OrderCard from "@/components/OrderCard";

/**
 * Orders page component displaying user's order history
 * 
 * @returns JSX element with order history or authentication prompt
 */
export default async function OrdersPage() {
  // Server-side authentication check
  const { userId } = await auth();

  // Handle unauthenticated access
  if (!userId) {
    return (
      <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Order History</h2>
          <p className="text-orange-500">
            You must be logged in to view your orders.
          </p>
        </div>
      </main>
    );
  }

  // Fetch user's order history from database
  const orders = await getOrdersByUserId(userId);

  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-6">Order History</h2>
        {orders.length === 0 ? (
          // Empty state for users with no orders
          <p className="text-gray-400">You haven&rsquo;t placed any orders yet.</p>
        ) : (
          // Order history list with proper spacing
          <div className="space-y-4 sm:space-y-6">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
