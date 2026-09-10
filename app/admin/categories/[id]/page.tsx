import { Suspense } from "react";
import { requireAdminSession } from "@/lib/auth/admin-session";
import CategoryDetail from "./CategoryDetail";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  
  return (
    <div className="space-y-6 px-4">
      <Suspense fallback={<div className="text-gray-400">Loading category...</div>}>
        <CategoryDetail categoryId={id} />
      </Suspense>
    </div>
  );
}