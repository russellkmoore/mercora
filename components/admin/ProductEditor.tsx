"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import CategoryPicker from "./CategoryPicker";
import { X, Save, Package, Tag, DollarSign } from "lucide-react";
import type { Product } from "@/lib/types";

interface ProductEditorProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void>;
  isNew?: boolean;
}

export default function ProductEditor({ 
  product, 
  isOpen, 
  onClose, 
  onSave, 
  isNew = false 
}: ProductEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "archived" | "draft">("active");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"physical" | "digital" | "service">("physical");
  const [taxCategory, setTaxCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [inventory, setInventory] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      // Handle localized fields
      const productName = typeof product.name === 'string' ? product.name : Object.values(product.name)[0] || '';
      const productDesc = typeof product.description === 'string' ? product.description : Object.values(product.description || {})[0] || '';
      
      setName(productName);
      setDescription(productDesc);
      setSlug(product.slug || "");
      setBrand(product.brand || "");
      setStatus(product.status || "active");
      setCategories(product.categories || []);
      setTags(product.tags?.join(", ") || "");
      setFulfillmentType(product.fulfillment_type || "physical");
      setTaxCategory(product.tax_category || "");
      
      // Extract pricing from variants
      const defaultVariant = product.variants?.[0];
      if (defaultVariant?.price?.amount) {
        setPrice((defaultVariant.price.amount / 100).toString());
      }
      setSku(defaultVariant?.sku || "");
      setInventory(defaultVariant?.inventory?.quantity?.toString() || "");
      setWeight(defaultVariant?.weight?.value?.toString() || "");
    } else if (isNew) {
      // Reset all fields for new product
      setName("");
      setDescription("");
      setSlug("");
      setBrand("");
      setStatus("active");
      setCategories([]);
      setTags("");
      setFulfillmentType("physical");
      setTaxCategory("");
      setPrice("");
      setSku("");
      setInventory("");
      setWeight("");
    }
  }, [product, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const productData: Partial<Product> = {
        name: name.trim(),
        description: description.trim() || undefined,
        slug: slug.trim() || undefined,
        brand: brand.trim() || undefined,
        status,
        categories,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        fulfillment_type: fulfillmentType,
        tax_category: taxCategory.trim() || undefined,
      };

      // Add basic variant data if provided
      if (price || sku || inventory || weight) {
        const variantData: any = {};
        
        if (price) {
          variantData.price = {
            amount: Math.round(parseFloat(price) * 100),
            currency: "USD"
          };
        }
        
        if (sku) variantData.sku = sku;
        
        if (inventory) {
          variantData.inventory = {
            quantity: parseInt(inventory) || 0
          };
        }
        
        if (weight) {
          variantData.weight = {
            value: parseFloat(weight) || 0,
            unit: "lb"
          };
        }

        // If editing existing product, update default variant
        // If new product, create variant
        if (!isNew && product?.variants?.[0]) {
          variantData.id = product.variants[0].id;
        } else {
          variantData.id = `variant_${Date.now()}`;
          variantData.title = name;
        }
        
        productData.variants = [variantData];
        productData.default_variant_id = variantData.id;
      }

      if (isNew) {
        productData.id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      await onSave(productData);
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-4xl max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Package className="w-5 h-5 mr-2" />
              {isNew ? "Create New Product" : "Edit Product"}
            </h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-400">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product name..."
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Brand
                </label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand name..."
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description..."
                rows={4}
                className="bg-neutral-700 border-neutral-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                URL Slug
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
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Categories & Tags
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categories
              </label>
              <CategoryPicker
                selectedCategoryIds={categories}
                onChange={setCategories}
                placeholder="Select product categories..."
              />
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
          </div>

          {/* Pricing & Inventory */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Pricing & Inventory
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SKU
                </label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU-001"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stock Quantity
                </label>
                <Input
                  type="number"
                  value={inventory}
                  onChange={(e) => setInventory(e.target.value)}
                  placeholder="0"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Weight (lb)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.0"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fulfillment Type
                </label>
                <select
                  value={fulfillmentType}
                  onChange={(e) => setFulfillmentType(e.target.value as any)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tax Category
                </label>
                <Input
                  value={taxCategory}
                  onChange={(e) => setTaxCategory(e.target.value)}
                  placeholder="standard"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-neutral-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Changes will be saved to your product catalog
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
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}