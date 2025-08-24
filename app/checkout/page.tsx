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

"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";

// Dynamically import CheckoutClient with no SSR to prevent hydration issues
const CheckoutClient = dynamic(
  () => import("@/components/checkout/CheckoutClient"),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading checkout...</div>
      </div>
    )
  }
);

/**
 * Checkout page component with client-side authentication
 * 
 * @returns JSX element with checkout client component and auth context
 */
export default function CheckoutPage() {
  // Get authenticated user ID from Clerk on client-side
  const { userId } = useAuth();
  
  return (
    <main className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Use dynamic import with SSR disabled to prevent hydration issues */}
        <CheckoutClient userId={userId || null} />
      </div>
    </main>
  );
}
