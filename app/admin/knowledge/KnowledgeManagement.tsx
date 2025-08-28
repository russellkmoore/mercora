"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, Plus, Edit, Trash2, Bot, RefreshCw, FileText, 
  Upload, Download, Eye, Calendar 
} from "lucide-react";

interface KnowledgeArticle {
  filename: string;
  title: string;
  content: string;
  lastModified: string;
  size: number;
  isVectorized?: boolean;
}

interface ArticleEditorProps {
  article: KnowledgeArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (article: Partial<KnowledgeArticle>) => Promise<void>;
  isNew?: boolean;
}

function ArticleEditor({ article, isOpen, onClose, onSave, isNew = false }: ArticleEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setFilename(article.filename);
    } else if (isNew) {
      setTitle("");
      setContent("");
      setFilename("");
    }
  }, [article, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        content,
        filename: filename || `${title.toLowerCase().replace(/\s+/g, '-')}.md`
      });
      onClose();
    } catch (error) {
      console.error("Error saving article:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isNew ? "Create New Article" : "Edit Article"}
            </h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-400">
              ✕
            </Button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title..."
                className="bg-neutral-700 border-neutral-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filename
              </label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="filename.md"
                className="bg-neutral-700 border-neutral-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Content (Markdown)
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Article Title\n\nYour content here..."
                rows={20}
                className="bg-neutral-700 border-neutral-600 font-mono text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-neutral-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Changes will automatically trigger AI vectorization
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {saving ? "Saving..." : "Save Article"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function KnowledgeManagement() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNewArticle, setIsNewArticle] = useState(false);

  const fetchArticles = async () => {
    try {
      const response = await fetch("/api/admin/knowledge?token=voltique-admin");
      if (response.ok) {
        const articles: KnowledgeArticle[] = await response.json();
        console.log("Loaded articles:", articles.length);
        setArticles(articles);
        setFilteredArticles(articles);
      } else {
        console.error("Failed to fetch articles:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error response:", errorText);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerVectorization = async () => {
    setIsVectorizing(true);
    try {
      // Direct call to admin vectorize endpoint
      // Token validation happens server-side via admin middleware
      const response = await fetch("/api/admin/vectorize");
      if (response.ok) {
        console.log("Vectorization triggered successfully");
      } else {
        throw new Error("Vectorization request failed");
      }
    } catch (error) {
      console.error("Error triggering vectorization:", error);
    } finally {
      setIsVectorizing(false);
    }
  };

  const handleSaveArticle = async (articleData: Partial<KnowledgeArticle>) => {
    try {
      console.log("Saving article:", articleData);
      const response = await fetch("/api/admin/knowledge?token=voltique-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: articleData.filename,
          title: articleData.title,
          content: articleData.content,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Article saved successfully:", result);
        // Refresh the articles list
        await fetchArticles();
      } else {
        const error: any = await response.json();
        console.error("Failed to save article:", error);
        throw new Error(error.error || "Failed to save article");
      }
    } catch (error) {
      console.error("Error saving article:", error);
      throw error; // Re-throw to handle in the editor
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    
    try {
      const response = await fetch(`/api/admin/knowledge?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh the articles list
        await fetchArticles();
        console.log("Article deleted successfully");
      } else {
        const error: any = await response.json();
        console.error("Failed to delete article:", error);
        alert("Failed to delete article: " + (error.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error deleting article:", error);
      alert("Failed to delete article");
    }
  };

  const openEditor = (article: KnowledgeArticle | null = null, isNew = false) => {
    setSelectedArticle(article);
    setIsNewArticle(isNew);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedArticle(null);
    setIsNewArticle(false);
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredArticles(articles);
      return;
    }

    const filtered = articles.filter((article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredArticles(filtered);
  }, [searchQuery, articles]);

  if (loading) {
    return <div className="text-gray-400">Loading knowledge base...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-neutral-800 border-neutral-700"
            />
          </div>
          <Button
            onClick={triggerVectorization}
            disabled={isVectorizing}
            variant="outline"
            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
          >
            {isVectorizing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-2" />
            )}
            {isVectorizing ? "Vectorizing..." : "Reindex AI"}
          </Button>
        </div>
        <Button 
          onClick={() => openEditor(null, true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Article
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{articles.length}</div>
          <div className="text-sm text-gray-400">Total Articles</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">
            {articles.filter(a => a.isVectorized).length}
          </div>
          <div className="text-sm text-gray-400">AI Indexed</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">
            {Math.round(articles.reduce((acc, a) => acc + a.size, 0) / 1024)}
          </div>
          <div className="text-sm text-gray-400">KB Total Size</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-blue-400">
            {articles.filter(a => {
              const modified = new Date(a.lastModified);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return modified > weekAgo;
            }).length}
          </div>
          <div className="text-sm text-gray-400">Updated This Week</div>
        </Card>
      </div>

      {/* AI Assistant Card */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border-orange-500/30 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              AI-Powered Knowledge Management
            </h3>
            <p className="text-gray-300 text-sm">
              Articles stored in R2 are automatically vectorized for Volt AI. Changes trigger 
              instant reindexing so customers get the latest information immediately.
            </p>
          </div>
          <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black">
            Ask Volt AI
          </Button>
        </div>
      </Card>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <Card key={article.filename} className="bg-neutral-800 border-neutral-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex items-center space-x-2">
                {article.isVectorized ? (
                  <Badge variant="default" className="bg-green-600 text-white">
                    <Bot className="w-3 h-3 mr-1" />
                    AI Ready
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-2">{article.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{article.filename}</p>
            
            <div className="flex items-center text-xs text-gray-500 mb-4">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(article.lastModified).toLocaleDateString()}
              <span className="mx-2">•</span>
              {Math.round(article.size / 1024)} KB
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditor(article)}
                className="text-orange-500 hover:text-orange-400"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-500 hover:text-blue-400"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(article.filename)}
                className="text-red-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredArticles.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery ? "No articles found matching your search." : "No articles available."}
        </div>
      )}

      {/* Article Editor Modal */}
      <ArticleEditor
        article={selectedArticle}
        isOpen={showEditor}
        onClose={closeEditor}
        onSave={handleSaveArticle}
        isNew={isNewArticle}
      />
    </div>
  );
}