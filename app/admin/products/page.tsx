/**
 * === Admin Products Page ===
 *
 * Product management page for the admin dashboard that provides access
 * to the comprehensive product management interface. Acts as a wrapper
 * for the ProductManagement component with proper page structure.
 *
 * === Features ===
 * - **Page Header**: Clear page title and description
 * - **Product Management**: Full CRUD operations via ProductManagement component
 * - **AI Integration**: AI-assisted product management features
 * - **Professional Layout**: Consistent admin page styling and spacing
 *
 * === Page Structure ===
 * - **Header Section**: Page title and contextual description
 * - **Management Interface**: ProductManagement component with full functionality
 * - **Responsive Layout**: Mobile-optimized with proper spacing
 *
 * === Product Management Features ===
 * (Via ProductManagement component)
 * - Product creation, editing, and deletion
 * - Category assignment and organization
 * - Inventory tracking and management
 * - Image upload and media management
 * - Pricing and variant management
 * - AI-powered product optimization
 *
 * @returns JSX element with product management page layout
 */

import ProductManagement from "./ProductManagement";

/**
 * Admin products page component that wraps the product management interface
 * 
 * @returns Product management page with header and ProductManagement component
 */
export default function AdminProductsPage() {
  return (
    <div className="space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Product Management</h1>
        <p className="text-gray-400 mt-1">
          Manage your product catalog with AI assistance
        </p>
      </div>
      
      <ProductManagement />
    </div>
  );
}