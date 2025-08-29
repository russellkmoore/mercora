/**
 * === Admin Knowledge Base Management Page ===
 *
 * Knowledge base management interface for maintaining help articles,
 * FAQs, and support documentation. Features R2 storage integration
 * and automatic AI vectorization for enhanced search capabilities.
 *
 * === Features ===
 * - **Knowledge Article Management**: CRUD operations for help content
 * - **R2 Storage Integration**: Efficient cloud storage for knowledge articles
 * - **Automatic Vectorization**: AI-powered indexing for semantic search
 * - **Suspense Loading**: Progressive loading with fallback states
 * - **Vector Search Integration**: Knowledge articles become searchable by Volt AI
 *
 * === Knowledge Base Features ===
 * (Via KnowledgeManagement component)
 * - Article creation, editing, and deletion
 * - Markdown support for rich content formatting
 * - Automatic AI vectorization upon save
 * - Integration with Volt AI for customer support
 * - R2 cloud storage for scalable content management
 *
 * === Technical Implementation ===
 * - **Suspense Integration**: Loading states for knowledge base data
 * - **R2 Storage**: Cloud-native content storage and retrieval
 * - **Vector Integration**: Automatic indexing for AI search capabilities
 * - **Progressive Loading**: Optimized user experience with loading fallbacks
 *
 * @returns JSX element with knowledge base management interface
 */

import { Suspense } from "react";
import KnowledgeManagement from "./KnowledgeManagement";

/**
 * Admin knowledge base page component for managing help articles and documentation
 * 
 * @returns Knowledge base management page with suspense loading
 */
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