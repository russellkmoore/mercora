import { Suspense } from "react";
import KnowledgeManagement from "./KnowledgeManagement";

export default function AdminKnowledgePage() {
  return (
    <div className="space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Knowledge Base Management</h1>
        <p className="text-gray-400 mt-1">
          Manage knowledge articles with R2 storage and automatic AI vectorization
        </p>
      </div>
      
      <Suspense fallback={<div className="text-gray-400">Loading knowledge base...</div>}>
        <KnowledgeManagement />
      </Suspense>
    </div>
  );
}