import ProductManagement from "./ProductManagement";

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