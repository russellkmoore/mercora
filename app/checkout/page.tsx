/**
 * === Checkout Page Component ===
 *
 * A server-side rendered checkout page that provides authentication
 * context and renders the checkout flow. Handles user authentication
 * state and passes it to the client-side checkout component.
 *
 * === Features ===
 * - **Server Authentication**: Uses Clerk for server-side auth checking
 * - **User Context**: Passes authenticated user ID to checkout flow
 * - **Clean Layout**: Consistent page structure with proper spacing
 * - **Responsive Design**: Mobile-first approach with desktop optimization
 * - **Security**: Server-side auth validation before checkout access
 *
 * === Technical Implementation ===
 * - **Server Component**: Leverages Next.js 14 app router for SSR
 * - **Clerk Integration**: Server-side authentication with auth() helper
 * - **Client Handoff**: Passes auth state to client-side checkout component
 * - **Layout Consistency**: Matches global page styling patterns
 *
 * === Authentication Flow ===
 * - Checks authentication status on server
 * - Passes userId (or null) to client component
 * - Client component handles authenticated vs guest checkout flows
 * - Maintains security boundaries between server and client
 *
 * === Usage ===
 * Rendered at "/checkout" route for cart completion flow
 * 
 * @returns Server-rendered checkout page with auth context
 */

import CheckoutClient from "@/components/checkout/CheckoutClient";
import { auth } from "@clerk/nextjs/server";

/**
 * Checkout page component with server-side authentication
 * 
 * @returns JSX element with checkout client component and auth context
 */
export default async function CheckoutPage() {
  // Get authenticated user ID from Clerk on server-side
  const { userId } = await auth();
  
  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Pass authentication state to client-side checkout flow */}
        <CheckoutClient userId={userId} />
      </div>
    </main>
  );
}
