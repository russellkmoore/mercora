import { Suspense } from "react";
import CategoryDetail from "./CategoryDetail";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <div className="space-y-6 px-4">
      <Suspense fallback={<div className="text-gray-400">Loading category...</div>}>
        <CategoryDetail categoryId={id} />
      </Suspense>
    </div>
  );
}