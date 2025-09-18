"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Bot, RefreshCw, Tag } from "lucide-react";
import Image from "next/image";
import ProductEditor from "@/components/admin/ProductEditor";
import type { Product } from "@/lib/types/";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

function ProductTable({ products, onEdit, onDelete }: ProductTableProps) {
  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-neutral-700">
          <tr>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Product</th>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Categories</th>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Price</th>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Stock</th>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Status</th>
            <th className="text-left p-4 text-sm font-medium text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const defaultVariant = product.variants?.[0];
            const price = defaultVariant?.price?.amount;
            const stock = defaultVariant?.inventory?.quantity ?? 0;
            const name = typeof product.name === "string" ? product.name : Object.values(product.name || {})[0] || "";
            
            return (
              <tr key={product.id} className="border-t border-neutral-700">
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-neutral-600 rounded-md overflow-hidden flex items-center justify-center">
                      {(() => {
                        // Extract primary image URL from product
                        const getPrimaryImageUrl = () => {
                          if (!product.primary_image) return null;
                          
                          try {
                            let imageData = product.primary_image;
                            
                            // Parse JSON string if needed
                            if (typeof imageData === "string" && (imageData as string).startsWith("{")) {
                              try {
                                imageData = JSON.parse(imageData);
                              } catch {
                                return null;
                              }
                            }
                            
                            // Handle MACH structure (file.url)
                            if (imageData?.file?.url) {
                              return imageData.file.url;
                            }
                            
                            // Handle flat structure (url) - this would be for non-MACH data
                            if ((imageData as any)?.url) {
                              return (imageData as any).url;
                            }
                            
                            return null;
                          } catch {
                            return null;
                          }
                        };

                        const imageUrl = getPrimaryImageUrl();
                        
                        if (imageUrl) {
                          return (
                            <Image
                              src={imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}
                              alt={name}
                              width={40}
                              height={40}
                              className="object-cover rounded-md"
                              sizes="40px"
                            />
                          );
                        }
                        
                        return <span className="text-lg">📦</span>;
                      })()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{name}</div>
                      <div className="text-sm text-gray-400">ID: {product.id}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {product.categories && product.categories.length > 0 ? (
                      product.categories.slice(0, 3).map((categoryId) => (
                        <Badge key={categoryId} variant="outline" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {categoryId}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">No categories</span>
                    )}
                    {product.categories && product.categories.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.categories.length - 3}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-4 text-white">
                  {price ? `$${(price / 100).toFixed(2)}` : "N/A"}
                </td>
                <td className="p-4">
                  <Badge variant={stock > 0 ? "default" : "destructive"}>
                    {stock} in stock
                  </Badge>
                </td>
                <td className="p-4">
                  <Badge variant={product.status === "active" ? "default" : "secondary"}>
                    {product.status || "draft"}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      className="text-orange-500 hover:text-orange-400"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(product.id.toString())}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalActiveProducts, setTotalActiveProducts] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);

  const fetchProducts = async (page: number = 1) => {
    try {
      const offset = (page - 1) * productsPerPage;
      const url = `/api/products?limit=${productsPerPage}&offset=${offset}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const result: any = await response.json();
        const products: Product[] = result.data || result || [];
        const meta = result.meta || {};
        
        // Update totals from API metadata
        const total = meta.total || products.length;
        setTotalProducts(total);
        setTotalPages(Math.ceil(total / productsPerPage));
        setCurrentPage(page);
        
        setProducts(products);
        setFilteredProducts(products);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerVectorization = async () => {
    setIsVectorizing(true);
    try {
      // Call admin vectorize endpoint (now uses session auth)
      const response = await fetch("/api/admin/vectorize");
      if (response.ok) {
        const result = await response.json() as any;
        console.log("Vectorization triggered successfully:", result?.message);
        // Show a success notification
        alert(`Vectorization complete! Indexed ${result?.summary?.totalIndexed || 0} items in ${(result?.executionTimeMs / 1000).toFixed(1)}s.`);
      } else {
        const error = await response.json() as any;
        throw new Error(error?.error || "Vectorization request failed");
      }
    } catch (error) {
      console.error("Error triggering vectorization:", error);
      alert("Failed to trigger vectorization: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, []);

  const handlePageChange = (page: number) => {
    setLoading(true);
    fetchProducts(page);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter((product) => {
      const name = typeof product.name === "string" ? product.name : Object.values(product.name || {})[0] || "";
      const description = typeof product.description === "string" ? product.description : Object.values(product.description || {})[0] || "";
      
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toString().includes(searchQuery)
      );
    });

    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      console.log("Saving product:", productData);
      const url = isNewProduct ? "/api/products" : `/api/products/${productData.id}`;
      const method = isNewProduct ? "POST" : "PUT";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Product saved successfully:", result);
        await fetchProducts(currentPage);
      } else {
        const error: any = await response.json();
        console.error("Failed to save product:", error);
        throw new Error(error.error || "Failed to save product");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      throw error;
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsNewProduct(false);
    setShowProductEditor(true);
  };

  const handleNewProduct = () => {
    setSelectedProduct(null);
    setIsNewProduct(true);
    setShowProductEditor(true);
  };

  const handleCloseProductEditor = () => {
    setShowProductEditor(false);
    setSelectedProduct(null);
    setIsNewProduct(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchProducts(currentPage);
        console.log("Product deleted successfully");
      } else {
        const error: any = await response.json();
        console.error("Failed to delete product:", error);
        alert("Failed to delete product: " + (error.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product");
    }
  };

  if (loading) {
    return <div className="text-gray-400">Loading products...</div>;
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
              placeholder="Search products..."
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
        <Button onClick={handleNewProduct} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{totalProducts}</div>
          <div className="text-sm text-gray-400">Total Products</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">
            {products.filter(p => p.status === "active").length}
          </div>
          <div className="text-sm text-gray-400">Active Products (This Page)</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">
            {products.filter(p => {
              const stock = p.variants?.[0]?.inventory?.quantity ?? 0;
              return stock > 0 && stock < 10;
            }).length}
          </div>
          <div className="text-sm text-gray-400">Low Stock (This Page)</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-red-400">
            {products.filter(p => {
              const stock = p.variants?.[0]?.inventory?.quantity ?? 0;
              return stock === 0;
            }).length}
          </div>
          <div className="text-sm text-gray-400">Out of Stock (Page)</div>
        </Card>
      </div>


      {/* Products Table */}
      <ProductTable
        products={filteredProducts}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Pagination Controls */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-400">
            Showing {((currentPage - 1) * productsPerPage) + 1}-{Math.min(currentPage * productsPerPage, totalProducts)} of {totalProducts} products
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="border-neutral-700 text-gray-300 hover:bg-neutral-700"
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, currentPage - 2) + i;
                if (pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loading}
                    className={pageNum === currentPage ? "bg-orange-600 hover:bg-orange-700" : "text-gray-300 hover:bg-neutral-700"}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="border-neutral-700 text-gray-300 hover:bg-neutral-700"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery ? "No products found matching your search." : "No products available."}
        </div>
      )}

      {/* Product Editor Modal */}
      <ProductEditor
        product={selectedProduct}
        isOpen={showProductEditor}
        onClose={handleCloseProductEditor}
        onSave={handleSaveProduct}
        isNew={isNewProduct}
      />
    </div>
  );
}