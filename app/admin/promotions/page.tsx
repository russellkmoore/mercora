import { Suspense } from "react";
import PromotionManagement from "./PromotionManagement";

export default function AdminPromotionsPage() {
  return (
    <div className="space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Promotion Management</h1>
        <p className="text-gray-400 mt-1">
          Create and manage discount codes and promotional campaigns
        </p>
      </div>
      
      <Suspense fallback={<div className="text-gray-400">Loading promotions...</div>}>
        <PromotionManagement />
      </Suspense>
    </div>
  );
}