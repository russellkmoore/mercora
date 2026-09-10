/**
 * === Admin Layout Component ===
 *
 * Dedicated layout for the admin section that provides a professional
 * admin interface with sidebar navigation and admin-specific header.
 * This layout overrides the root layout for all /admin routes.
 *
 * === Features ===
 * - **Admin Sidebar**: Collapsible navigation with admin menu items
 * - **Admin Header**: Breadcrumbs, page titles, and admin branding
 * - **Professional Theme**: Admin-optimized colors and spacing
 * - **Responsive Design**: Mobile-friendly sidebar collapse
 * - **State Management**: Sidebar toggle and layout preferences
 *
 * === Layout Structure ===
 * - **AdminHeader**: Top bar with breadcrumbs and title
 * - **AdminSidebar**: Left navigation panel with admin routes
 * - **Main Content**: Page content area with proper spacing
 *
 * === Usage ===
 * Automatically wraps all /admin/* pages in Next.js App Router
 */

import { Suspense } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminLayoutProvider from "@/components/admin/AdminLayoutProvider";
import AdminGuard from "@/components/admin/AdminGuard";
import { Toaster } from "sonner";
import { getStoreConfig } from "@/lib/store-config";
import { checkAdminSession } from "@/lib/auth/admin-middleware";

export function generateMetadata() {
  const store = getStoreConfig();
  return {
    title: `${store.identity.name} Admin`,
    description: `Admin dashboard for ${store.identity.name}`,
  };
}

/**
 * Admin layout component that wraps all admin pages
 *
 * Server gate (T-13-42): admin pages may server-render operational data (the
 * gift-card honor banner, for one), so the page tree is only mounted for a
 * request that already carries an admin Clerk session. Anyone else gets the
 * chrome and the client `AdminGuard`'s sign-in / access-denied UI, and no
 * page output. The API routes keep their own `checkAdminPermissions` gate.
 *
 * @param children - Admin page components to render within the layout
 * @returns Admin layout with sidebar and header
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await checkAdminSession();
  const content = session.success ? children : null;
  return (
    <AdminGuard>
      <AdminLayoutProvider>
        <div className="min-h-screen bg-neutral-950 text-white">
          {/* Admin Header */}
          <AdminHeader />
          
          <div className="flex">
            {/* Admin Sidebar */}
            <AdminSidebar />
            
            {/* Main Admin Content Area */}
            <div className="flex-1 transition-all duration-300 ease-in-out">
              <div className="p-6">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400">Loading...</div>
                  </div>
                }>
                  {content}
                </Suspense>
              </div>
            </div>
          </div>

          {/* Admin-specific toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              className:
                "bg-neutral-800 text-white border border-neutral-700 shadow-lg",
              duration: 4000,
            }}
          />
        </div>
      </AdminLayoutProvider>
    </AdminGuard>
  );
}
