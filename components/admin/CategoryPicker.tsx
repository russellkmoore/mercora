"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Search, X, Check, ChevronDown, ChevronRight, 
  FolderOpen, Plus, Tag
} from "lucide-react";
import type { Category } from "@/lib/types";

interface CategoryPickerProps {
  selectedCategoryIds: string[];
  onChange: (categoryIds: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  disabled?: boolean;
  className?: string;
}

interface CategoryTreeItemProps {
  category: Category;
  level: number;
  isSelected: boolean;
  onToggle: (categoryId: string) => void;
  expandedCategories: Set<string>;
  onToggleExpand: (categoryId: string) => void;
  searchQuery: string;
}

function CategoryTreeItem({ 
  category, 
  level, 
  isSelected, 
  onToggle, 
  expandedCategories, 
  onToggleExpand,
  searchQuery 
}: CategoryTreeItemProps) {
  const getCategoryName = (category: Category): string => {
    return typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
  };

  const hasChildren = (category: Category): boolean => {
    return !!(category.children && category.children.length > 0);
  };

  const isExpanded = expandedCategories.has(category.id);
  const name = getCategoryName(category);
  
  // Highlight search matches
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="bg-yellow-400 text-black">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-1">
      <div 
        className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-neutral-700/50 ${
          isSelected ? 'bg-orange-600/20 border border-orange-600/30' : ''
        }`}
        style={{ marginLeft: `${level * 16}px` }}
        onClick={() => onToggle(category.id)}
      >
        {hasChildren(category) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(category.id);
            }}
            className="p-0 h-auto w-4 text-gray-400 hover:text-white"
          >
            {isExpanded ? 
              <ChevronDown className="w-3 h-3" /> : 
              <ChevronRight className="w-3 h-3" />
            }
          </Button>
        ) : (
          <div className="w-4 h-3" /> // Spacer
        )}
        
        <div className="w-5 h-5 bg-orange-600/20 rounded flex items-center justify-center">
          <FolderOpen className="w-3 h-3 text-orange-400" />
        </div>
        
        <div className="flex items-center space-x-2 flex-1">
          <span className="text-sm text-white">
            {highlightText(name, searchQuery)}
          </span>
          {category.product_count !== undefined && category.product_count > 0 && (
            <Badge variant="outline" className="text-xs">
              {category.product_count}
            </Badge>
          )}
        </div>
        
        {isSelected && (
          <Check className="w-4 h-4 text-orange-400" />
        )}
      </div>
      
      {hasChildren(category) && isExpanded && category.children && (
        <div className="space-y-1">
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child as Category}
              level={level + 1}
              isSelected={false} // Child categories would need their own selection logic
              onToggle={onToggle}
              expandedCategories={expandedCategories}
              onToggleExpand={onToggleExpand}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryPicker({ 
  selectedCategoryIds, 
  onChange, 
  placeholder = "Select categories...",
  maxSelections,
  disabled = false,
  className = ""
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const result: any = await response.json();
        const categories: Category[] = result.data || [];
        setCategories(categories);
        
        // Auto-expand categories that have selected children
        const expandedSet = new Set<string>();
        categories.forEach(category => {
          if (category.children && category.children.some(child => selectedCategoryIds.includes(child.id))) {
            expandedSet.add(category.id);
          }
        });
        setExpandedCategories(expandedSet);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryIds]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, fetchCategories]);

  const getCategoryName = (category: Category): string => {
    return typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
  };

  const getSelectedCategories = (): Category[] => {
    return categories.filter(cat => selectedCategoryIds.includes(cat.id));
  };

  const handleToggleCategory = (categoryId: string) => {
    if (disabled) return;
    
    const newSelection = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter(id => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
      
    // Check max selections limit
    if (maxSelections && newSelection.length > maxSelections) {
      return;
    }
    
    onChange(newSelection);
  };

  const handleRemoveCategory = (categoryId: string) => {
    if (disabled) return;
    onChange(selectedCategoryIds.filter(id => id !== categoryId));
  };

  const handleToggleExpand = (categoryId: string) => {
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

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const filteredCategories = categories.filter(category => {
    if (!searchQuery) return true;
    const name = getCategoryName(category);
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           category.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const rootCategories = filteredCategories.filter(cat => !cat.parent_id);

  return (
    <div className={`relative ${className}`}>
      {/* Selected Categories Display */}
      <div className="space-y-2">
        {selectedCategoryIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {getSelectedCategories().map((category) => (
              <Badge
                key={category.id}
                variant="secondary"
                className="bg-orange-600/20 text-orange-300 border-orange-600/30"
              >
                <Tag className="w-3 h-3 mr-1" />
                {getCategoryName(category)}
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCategory(category.id)}
                    className="p-0 h-auto ml-2 hover:bg-transparent"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </Badge>
            ))}
            {selectedCategoryIds.length > 0 && !disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear all
              </Button>
            )}
          </div>
        )}

        {/* Picker Trigger */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full justify-between bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
        >
          <span className={selectedCategoryIds.length === 0 ? "text-gray-400" : ""}>
            {selectedCategoryIds.length === 0 
              ? placeholder 
              : `${selectedCategoryIds.length} categories selected`
            }
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-2 bg-neutral-800 border-neutral-700 shadow-lg max-h-80 overflow-hidden">
          <div className="p-3 border-b border-neutral-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="pl-10 bg-neutral-700 border-neutral-600"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto p-2">
            {loading ? (
              <div className="text-center py-4 text-gray-400">Loading categories...</div>
            ) : rootCategories.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                {searchQuery ? "No categories found" : "No categories available"}
              </div>
            ) : (
              <div className="space-y-1">
                {rootCategories.map((category) => (
                  <CategoryTreeItem
                    key={category.id}
                    category={category}
                    level={0}
                    isSelected={selectedCategoryIds.includes(category.id)}
                    onToggle={handleToggleCategory}
                    expandedCategories={expandedCategories}
                    onToggleExpand={handleToggleExpand}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-neutral-700 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {maxSelections && `${selectedCategoryIds.length}/${maxSelections} selected`}
            </div>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs"
            >
              Done
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}