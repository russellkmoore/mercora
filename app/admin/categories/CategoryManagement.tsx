"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, Plus, Edit, Trash2, Move, ChevronDown, ChevronRight,
  Tag, FolderOpen, Package, ArrowUpDown, Eye
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";

interface CategoryTreeProps {
  categories: Category[];
  allCategories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onMove: (categoryId: string, newParentId: string | null) => void;
  level?: number;
}

function CategoryTree({ categories, allCategories, onEdit, onDelete, onMove, level = 0 }: CategoryTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const getCategoryName = (category: Category): string => {
    return typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
  };

  const hasChildren = (category: Category): boolean => {
    return allCategories.some(child => child.parent_id === category.id);
  };

  const getChildCategories = (parentId: string): Category[] => {
    return allCategories.filter(cat => cat.parent_id === parentId);
  };

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-6 border-l border-gray-700 pl-4' : ''}`}>
      {categories.map((category) => (
        <div key={category.id} className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex items-center space-x-3">
              {hasChildren(category) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(category.id)}
                  className="p-0 h-auto text-gray-400 hover:text-white"
                >
                  {expandedCategories.has(category.id) ? 
                    <ChevronDown className="w-4 h-4" /> : 
                    <ChevronRight className="w-4 h-4" />
                  }
                </Button>
              ) : (
                <div className="w-4 h-4" /> // Spacer
              )}
              
              <div className="w-8 h-8 bg-orange-600/20 rounded-md flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-orange-400" />
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-white">{getCategoryName(category)}</span>
                  <Badge variant={category.status === 'active' ? 'default' : 'secondary'}>
                    {category.status || 'active'}
                  </Badge>
                  {category.product_count !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {category.product_count}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  ID: {category.id} • Path: {category.path || '/'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/admin/categories/${category.id}`, '_blank')}
                className="text-blue-500 hover:text-blue-400"
                title="View category products"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(category)}
                className="text-orange-500 hover:text-orange-400"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-400"
                title="Move category (coming soon)"
              >
                <Move className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(category.id)}
                className="text-red-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {hasChildren(category) && expandedCategories.has(category.id) && (
            <CategoryTree
              categories={getChildCategories(category.id)}
              allCategories={allCategories}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface CategoryEditorProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Partial<Category>) => Promise<void>;
  isNew?: boolean;
  allCategories: Category[];
}

function CategoryEditor({ category, isOpen, onClose, onSave, isNew = false, allCategories }: CategoryEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">("active");
  const [tags, setTags] = useState("");
  const [position, setPosition] = useState<number>(1);
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      const categoryName = typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
      const categoryDesc = typeof category.description === 'string' ? category.description : Object.values(category.description || {})[0] || '';
      const categorySlug = typeof category.slug === 'string' ? category.slug : Object.values(category.slug || {})[0] || '';
      
      setName(categoryName);
      setDescription(categoryDesc);
      setSlug(categorySlug);
      setParentId(category.parent_id || "");
      setStatus(category.status || "active");
      setTags(category.tags?.join(", ") || "");
      setPosition(category.position || 1);
      setPrimaryImageUrl(category.primary_image?.file?.url || "");
    } else if (isNew) {
      setName("");
      setDescription("");
      setSlug("");
      setParentId("");
      setStatus("active");
      setTags("");
      setPosition(1);
      setPrimaryImageUrl("");
    }
  }, [category, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const categoryData: Partial<Category> = {
        name: name.trim(),
        description: description.trim() || undefined,
        slug: slug.trim() || undefined,
        parent_id: parentId || undefined,
        status,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        position,
        primary_image: primaryImageUrl.trim() ? {
          id: `img_${Date.now()}`,
          type: "image",
          file: {
            url: primaryImageUrl.trim(),
            format: primaryImageUrl.trim().split('.').pop()?.toLowerCase() || "jpg"
          },
          accessibility: {
            alt_text: name.trim()
          }
        } : undefined,
      };

      if (isNew) {
        categoryData.id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      await onSave(categoryData);
      onClose();
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setSaving(false);
    }
  };

  // Generate slug from name
  const generateSlug = () => {
    if (name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  };

  if (!isOpen) return null;

  const rootCategories = allCategories.filter(cat => !cat.parent_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isNew ? "Create New Category" : "Edit Category"}
            </h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-400">
              ✕
            </Button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name..."
              className="bg-neutral-700 border-neutral-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Slug
            </label>
            <div className="flex space-x-2">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-friendly-slug"
                className="bg-neutral-700 border-neutral-600 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateSlug}
                className="px-3"
              >
                Generate
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category description..."
              rows={3}
              className="bg-neutral-700 border-neutral-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Image URL
            </label>
            <Input
              value={primaryImageUrl}
              onChange={(e) => setPrimaryImageUrl(e.target.value)}
              placeholder="https://example.com/category-image.jpg"
              className="bg-neutral-700 border-neutral-600"
            />
            {primaryImageUrl && (
              <div className="mt-2">
                <img 
                  src={primaryImageUrl} 
                  alt="Primary image preview" 
                  className="w-20 h-20 object-cover rounded border border-neutral-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Parent Category
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
              >
                <option value="">No Parent (Root Category)</option>
                {rootCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {typeof cat.name === 'string' ? cat.name : Object.values(cat.name)[0]}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "archived")}
                className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags (comma-separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="bg-neutral-700 border-neutral-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Position
            </label>
            <Input
              type="number"
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value) || 1)}
              min={1}
              className="bg-neutral-700 border-neutral-600"
            />
          </div>

          {!isNew && category && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Products in Category
              </label>
              <div className="bg-neutral-700 border border-neutral-600 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">
                    {category.product_count || 0} products
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/admin/categories/${category.id}`, '_blank')}
                    className="text-xs"
                  >
                    Manage Products
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Use the "Manage Products" button to add, remove, or organize products in this category.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-neutral-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Categories help organize products for better navigation and discovery
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {saving ? "Saving..." : isNew ? "Create Category" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function CategoryManagement() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories?include_inactive=true");
      if (response.ok) {
        const result: any = await response.json();
        const categories: Category[] = result.data || [];
        
        setCategories(categories);
        setFilteredCategories(categories);
      } else {
        console.error("Failed to fetch categories:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async (categoryData: Partial<Category>) => {
    try {
      console.log("Saving category:", categoryData);
      const url = isNewCategory ? "/api/categories" : `/api/categories/${categoryData.id}`;
      const method = isNewCategory ? "POST" : "PUT";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(categoryData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Category saved successfully:", result);
        await fetchCategories();
      } else {
        const error: any = await response.json();
        console.error("Failed to save category:", error);
        throw new Error(error.error || "Failed to save category");
      }
    } catch (error) {
      console.error("Error saving category:", error);
      throw error;
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchCategories();
        console.log("Category deleted successfully");
      } else {
        const error: any = await response.json();
        console.error("Failed to delete category:", error);
        alert("Failed to delete category: " + (error.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category");
    }
  };

  const handleMoveCategory = async (categoryId: string, newParentId: string | null) => {
    // TODO: Implement move functionality
    console.log("Move category", categoryId, "to parent", newParentId);
  };

  const openEditor = (category: Category | null = null, isNew = false) => {
    setSelectedCategory(category);
    setIsNewCategory(isNew);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedCategory(null);
    setIsNewCategory(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter((category) => {
      const name = typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
      const description = typeof category.description === 'string' ? category.description : Object.values(category.description || {})[0] || '';
      
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (category.tags && category.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );
    });

    setFilteredCategories(filtered);
  }, [searchQuery, categories]);

  if (loading) {
    return <div className="text-gray-400">Loading categories...</div>;
  }

  const rootCategories = filteredCategories.filter(cat => !cat.parent_id);
  
  // Categories are already flat now
  const totalCategories = categories.length;
  const activeCategories = categories.filter(cat => cat.status === 'active').length;
  const totalProducts = categories.reduce((sum, cat) => sum + (cat.product_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-neutral-800 border-neutral-700"
            />
          </div>
          
          <div className="flex items-center space-x-2 bg-neutral-800 rounded-lg p-1">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('tree')}
              className="text-xs"
            >
              Tree View
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="text-xs"
            >
              List View
            </Button>
          </div>
        </div>
        
        <Button 
          onClick={() => openEditor(null, true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{totalCategories}</div>
          <div className="text-sm text-gray-400">Total Categories</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">{activeCategories}</div>
          <div className="text-sm text-gray-400">Active Categories</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">{totalProducts}</div>
          <div className="text-sm text-gray-400">Total Products</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-blue-400">{rootCategories.length}</div>
          <div className="text-sm text-gray-400">Root Categories</div>
        </Card>
      </div>

      {/* Categories Display */}
      {viewMode === 'tree' ? (
        <Card className="bg-neutral-900 border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Category Hierarchy</h3>
          {filteredCategories.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-400">
              {searchQuery ? "No categories found matching your search." : "No categories available."}
            </div>
          ) : (
            <CategoryTree
              categories={rootCategories}
              allCategories={filteredCategories}
              onEdit={openEditor}
              onDelete={handleDeleteCategory}
              onMove={handleMoveCategory}
            />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => {
            const name = typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
            return (
              <Card key={category.id} className="bg-neutral-800 border-neutral-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={category.status === 'active' ? 'default' : 'secondary'}>
                      {category.status || 'active'}
                    </Badge>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
                <p className="text-sm text-gray-400 mb-3">{category.path || '/'}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <Package className="w-3 h-3 mr-1" />
                    {category.product_count || 0} products
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/admin/categories/${category.id}`)}
                      className="text-blue-500 hover:text-blue-400"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditor(category)}
                      className="text-orange-500 hover:text-orange-400"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Editor Modal */}
      <CategoryEditor
        category={selectedCategory}
        isOpen={showEditor}
        onClose={closeEditor}
        onSave={handleSaveCategory}
        isNew={isNewCategory}
        allCategories={categories}
      />
    </div>
  );
}