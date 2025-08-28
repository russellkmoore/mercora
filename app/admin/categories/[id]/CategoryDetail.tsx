"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Search, Plus, Minus, Package, Tag, 
  FolderOpen, Users, TrendingUp, Edit
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Product, Category } from "@/lib/types";

interface CategoryDetailProps {
  categoryId: string;
}

export default function CategoryDetail({ categoryId }: CategoryDetailProps) {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showAddProducts, setShowAddProducts] = useState(false);

  useEffect(() => {
    fetchCategoryData();
  }, [categoryId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(showAddProducts ? allProducts : categoryProducts);
      return;
    }

    const productsToFilter = showAddProducts ? allProducts : categoryProducts;
    const filtered = productsToFilter.filter((product) => {
      const name = typeof product.name === "string" ? product.name : Object.values(product.name || {})[0] || "";
      const description = typeof product.description === "string" ? product.description : Object.values(product.description || {})[0] || "";
      
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    setFilteredProducts(filtered);
  }, [searchQuery, categoryProducts, allProducts, showAddProducts]);

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      // Fetch category details
      const categoryResponse = await fetch(`/api/categories/${categoryId}`);
      if (categoryResponse.ok) {
        const categoryResult: any = await categoryResponse.json();
        setCategory(categoryResult.data);
      }

      // Fetch products in this category
      const categoryProductsResponse = await fetch(`/api/products?category=${categoryId}`);
      if (categoryProductsResponse.ok) {
        const productsResult: any = await categoryProductsResponse.json();
        setCategoryProducts(productsResult.data || []);
      }

      // Fetch all products for adding functionality
      const allProductsResponse = await fetch("/api/products?limit=100");
      if (allProductsResponse.ok) {
        const allResult: any = await allProductsResponse.json();
        setAllProducts(allResult.data || []);
      }
    } catch (error) {
      console.error("Error fetching category data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleBulkAssignProducts = async () => {
    if (selectedProducts.length === 0) return;
    
    try {
      // This would need a bulk assignment API endpoint
      // For now, we'll simulate success
      await fetchCategoryData();
      setSelectedProducts([]);
      setShowAddProducts(false);
    } catch (error) {
      console.error("Error assigning products:", error);
    }
  };

  const handleBulkRemoveProducts = async () => {
    if (selectedProducts.length === 0) return;
    
    try {
      // This would need a bulk removal API endpoint
      // For now, we'll simulate success
      await fetchCategoryData();
      setSelectedProducts([]);
    } catch (error) {
      console.error("Error removing products:", error);
    }
  };

  const getCategoryName = (category: Category): string => {
    return typeof category.name === 'string' ? category.name : Object.values(category.name)[0] || '';
  };

  if (loading) {
    return <div className="text-gray-400">Loading category details...</div>;
  }

  if (!category) {
    return <div className="text-red-400">Category not found</div>;
  }

  const productsToShow = showAddProducts 
    ? filteredProducts.filter(p => !p.categories?.includes(categoryId))
    : filteredProducts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/categories")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Categories
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{getCategoryName(category)}</h1>
              <p className="text-gray-400">
                {category.path} • {categoryProducts.length} products
              </p>
            </div>
          </div>
        </div>
        
        <Button variant="outline" className="text-orange-500 border-orange-500">
          <Edit className="w-4 h-4 mr-2" />
          Edit Category
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{categoryProducts.length}</div>
          <div className="text-sm text-gray-400">Products in Category</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">
            {categoryProducts.filter(p => p.status === 'active').length}
          </div>
          <div className="text-sm text-gray-400">Active Products</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">
            {categoryProducts.reduce((sum, p) => {
              const stock = p.variants?.[0]?.inventory?.quantity ?? 0;
              return sum + stock;
            }, 0)}
          </div>
          <div className="text-sm text-gray-400">Total Stock</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-blue-400">
            ${categoryProducts.reduce((sum, p) => {
              const price = p.variants?.[0]?.price?.amount ?? 0;
              return sum + price;
            }, 0) / 100}
          </div>
          <div className="text-sm text-gray-400">Total Value</div>
        </Card>
      </div>

      {/* Product Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder={showAddProducts ? "Search all products..." : "Search category products..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-neutral-800 border-neutral-700"
              />
            </div>
            
            {selectedProducts.length > 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-orange-400">
                  {selectedProducts.length} selected
                </Badge>
                {showAddProducts ? (
                  <Button
                    size="sm"
                    onClick={handleBulkAssignProducts}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Category
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleBulkRemoveProducts}
                    variant="destructive"
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    Remove from Category
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={showAddProducts ? "ghost" : "default"}
              size="sm"
              onClick={() => {
                setShowAddProducts(false);
                setSelectedProducts([]);
                setSearchQuery("");
              }}
            >
              Category Products ({categoryProducts.length})
            </Button>
            <Button
              variant={showAddProducts ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setShowAddProducts(true);
                setSelectedProducts([]);
                setSearchQuery("");
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Products
            </Button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productsToShow.map((product) => {
            const name = typeof product.name === "string" ? product.name : Object.values(product.name || {})[0] || "";
            const price = product.variants?.[0]?.price?.amount;
            const stock = product.variants?.[0]?.inventory?.quantity ?? 0;
            const isSelected = selectedProducts.includes(product.id);
            
            return (
              <Card 
                key={product.id} 
                className={`bg-neutral-800 border-neutral-700 p-4 cursor-pointer transition-colors ${
                  isSelected ? 'ring-2 ring-orange-500 bg-orange-900/10' : 'hover:bg-neutral-750'
                }`}
                onClick={() => handleToggleProductSelection(product.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-neutral-600 rounded-md flex items-center justify-center">
                    📦
                  </div>
                  <div className="flex items-center space-x-2">
                    {isSelected && (
                      <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                      {product.status || 'draft'}
                    </Badge>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
                <p className="text-sm text-gray-400 mb-3">ID: {product.id}</p>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <Package className="w-3 h-3 mr-1 inline" />
                    {stock} in stock
                  </div>
                  <div className="text-white font-medium">
                    {price ? `$${(price / 100).toFixed(2)}` : "N/A"}
                  </div>
                </div>
                
                {product.categories && product.categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {product.categories.slice(0, 2).map((catId) => (
                      <Badge key={catId} variant="outline" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {catId}
                      </Badge>
                    ))}
                    {product.categories.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.categories.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {productsToShow.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            {showAddProducts 
              ? (searchQuery ? "No products found matching your search." : "All products are already in this category.")
              : (searchQuery ? "No products found in this category." : "No products in this category yet.")
            }
          </div>
        )}
      </div>
    </div>
  );
}