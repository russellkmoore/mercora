/**
 * === Admin Categories Page ===
 *
 * Category management page for organizing the product catalog with
 * hierarchical categories. Provides access to comprehensive category
 * management tools for structuring the product taxonomy.
 *
 * === Features ===
 * - **Category Hierarchy**: Organize products in logical groupings
 * - **CRUD Operations**: Create, edit, and delete categories via CategoryManagement
 * - **Category Structure**: Support for nested category relationships
 * - **Product Assignment**: Manage product-category associations
 *
 * @returns JSX element with category management page layout
 */

import CategoryManagement from "./CategoryManagement";

/**
 * Admin categories page component for category management interface
 * 
 * @returns Category management page with CategoryManagement component
 */
export default function AdminCategoriesPage() {
  return (
    <div className="space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Category Management</h1>
        <p className="text-gray-400 mt-1">
          Organize your product catalog with hierarchical categories
        </p>
      </div>
      
      <CategoryManagement />
    </div>
  );
}