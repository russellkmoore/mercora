"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Bot, RefreshCw } from "lucide-react";
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
                    <div className="w-10 h-10 bg-neutral-600 rounded-md flex items-center justify-center">
                      📦
                    </div>
                    <div>
                      <div className="font-medium text-white">{name}</div>
                      <div className="text-sm text-gray-400">ID: {product.id}</div>
                    </div>
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

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (response.ok) {
        const data: Product[] = await response.json();
        setProducts(data);
        setFilteredProducts(data);
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
      const response = await fetch("/api/vectorize?token=voltique-admin");
      if (response.ok) {
        // Show success message or notification
        console.log("Vectorization triggered successfully");
      }
    } catch (error) {
      console.error("Error triggering vectorization:", error);
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleEdit = (product: Product) => {
    // TODO: Open edit modal or navigate to edit page
    console.log("Edit product:", product);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    // TODO: Implement delete functionality
    console.log("Delete product:", id);
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
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <div className="text-sm text-gray-400">Total Products</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">
            {products.filter(p => p.status === "active").length}
          </div>
          <div className="text-sm text-gray-400">Active Products</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">
            {products.filter(p => {
              const stock = p.variants?.[0]?.inventory?.quantity ?? 0;
              return stock > 0 && stock < 10;
            }).length}
          </div>
          <div className="text-sm text-gray-400">Low Stock</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-red-400">
            {products.filter(p => {
              const stock = p.variants?.[0]?.inventory?.quantity ?? 0;
              return stock === 0;
            }).length}
          </div>
          <div className="text-sm text-gray-400">Out of Stock</div>
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
              AI-Powered Product Management
            </h3>
            <p className="text-gray-300 text-sm">
              Get intelligent suggestions for product descriptions, pricing optimization, 
              and inventory management. Ask Volt AI about product performance and trends.
            </p>
          </div>
          <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black">
            Ask Volt AI
          </Button>
        </div>
      </Card>

      {/* Products Table */}
      <ProductTable
        products={filteredProducts}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery ? "No products found matching your search." : "No products available."}
        </div>
      )}
    </div>
  );
}