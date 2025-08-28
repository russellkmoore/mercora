import CategoryManagement from "./CategoryManagement";

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