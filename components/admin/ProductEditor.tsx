"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import CategoryPicker from "./CategoryPicker";
import { X, Save, Package, Tag, DollarSign, Plus, Trash2, Search, ImageIcon, Star, Link, ExternalLink, Upload, Clock, FileText, Settings } from "lucide-react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { getImageDisplayPath, generateR2Filename } from "@/lib/utils/r2";

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
  
  // SEO fields
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  
  // Media fields
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [primaryImageAlt, setPrimaryImageAlt] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  
  // Upload states
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  // Rating fields
  const [ratingAverage, setRatingAverage] = useState("");
  const [ratingCount, setRatingCount] = useState("");
  
  // Related products and external references
  const [relatedProducts, setRelatedProducts] = useState("");
  const [externalReferences, setExternalReferences] = useState("");
  
  // Product type and timestamps
  const [productType, setProductType] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  
  // Product options and extensions
  const [productOptions, setProductOptions] = useState("");
  const [extensions, setExtensions] = useState("");
  
  // Variant management state
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [variants, setVariants] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Current variant fields (based on selected variant)
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [cost, setCost] = useState("");
  const [sku, setSku] = useState("");
  const [inventory, setInventory] = useState("");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [barcode, setBarcode] = useState("");
  const [variantStatus, setVariantStatus] = useState<"active" | "inactive" | "discontinued">("active");
  const [shippingRequired, setShippingRequired] = useState(true);
  const [variantPosition, setVariantPosition] = useState("");
  const [variantAttributes, setVariantAttributes] = useState("");

  // Helper function to load variant data into form fields
  const loadVariantData = (variant: any) => {
    setPrice(variant?.price?.amount ? (variant.price.amount / 100).toString() : "");
    setCompareAtPrice(variant?.compare_at_price?.amount ? (variant.compare_at_price.amount / 100).toString() : "");
    setCost(variant?.cost?.amount ? (variant.cost.amount / 100).toString() : "");
    setSku(variant?.sku || "");
    setInventory(variant?.inventory?.quantity?.toString() || "");
    setWeight(variant?.weight?.value?.toString() || "");
    setBarcode(variant?.barcode || "");
    setVariantStatus(variant?.status || "active");
    setShippingRequired(variant?.shipping_required !== false);
    setVariantPosition(variant?.position?.toString() || "");
    
    // Handle dimensions
    if (variant?.dimensions) {
      const dims = variant.dimensions;
      setDimensions(`${dims.length || ''}x${dims.width || ''}x${dims.height || ''} ${dims.unit || 'inches'}`);
    } else {
      setDimensions("");
    }
    
    // Handle attributes (convert object to JSON string for editing)
    if (variant?.attributes && typeof variant.attributes === 'object') {
      setVariantAttributes(JSON.stringify(variant.attributes, null, 2));
    } else {
      setVariantAttributes("");
    }
  };

  // Helper function to reset variant fields
  const resetVariantFields = () => {
    setPrice("");
    setCompareAtPrice("");
    setCost("");
    setSku("");
    setInventory("");
    setWeight("");
    setDimensions("");
    setBarcode("");
    setVariantStatus("active");
    setShippingRequired(true);
    setVariantPosition("");
    setVariantAttributes("");
  };

  // Variant management functions
  const handleVariantSwitch = (index: number) => {
    // Save current variant data before switching
    if (variants.length > selectedVariantIndex) {
      saveCurrentVariantData();
    }
    
    setSelectedVariantIndex(index);
    if (variants[index]) {
      loadVariantData(variants[index]);
    }
  };

  const saveCurrentVariantData = () => {
    if (variants.length === 0) return;
    
    const updatedVariants = [...variants];
    const currentVariant = updatedVariants[selectedVariantIndex] || {};
    
    // Parse dimensions
    let dimensionsObj = undefined;
    if (dimensions) {
      const dimMatch = dimensions.match(/(\d*\.?\d*)x(\d*\.?\d*)x(\d*\.?\d*)\s*(\w+)?/);
      if (dimMatch) {
        dimensionsObj = {
          length: parseFloat(dimMatch[1]) || 0,
          width: parseFloat(dimMatch[2]) || 0,
          height: parseFloat(dimMatch[3]) || 0,
          unit: dimMatch[4] || "in"
        };
      }
    }
    
    // Parse attributes JSON
    let attributesObj = undefined;
    if (variantAttributes) {
      try {
        attributesObj = JSON.parse(variantAttributes);
      } catch (e) {
        console.warn("Invalid JSON in variant attributes:", e);
      }
    }
    
    updatedVariants[selectedVariantIndex] = {
      ...currentVariant,
      price: price ? { amount: Math.round(parseFloat(price) * 100), currency: "USD" } : undefined,
      compare_at_price: compareAtPrice ? { amount: Math.round(parseFloat(compareAtPrice) * 100), currency: "USD" } : undefined,
      cost: cost ? { amount: Math.round(parseFloat(cost) * 100), currency: "USD" } : undefined,
      sku: sku || undefined,
      inventory: inventory ? { quantity: parseInt(inventory) } : undefined,
      weight: weight ? { value: parseFloat(weight), unit: "lb" } : undefined,
      dimensions: dimensionsObj,
      barcode: barcode || undefined,
      status: variantStatus,
      shipping_required: shippingRequired,
      position: variantPosition ? parseInt(variantPosition) : undefined,
      attributes: attributesObj
    };
    
    setVariants(updatedVariants);
  };

  const addNewVariant = () => {
    // Save current variant data first
    saveCurrentVariantData();
    
    const newVariant = {
      id: `new-variant-${Date.now()}`,
      sku: `SKU-${variants.length + 1}`,
      price: { amount: 0, currency: "USD" },
      option_values: [],
      status: "active",
      inventory: { quantity: 0 },
      shipping_required: true
    };
    
    const newVariants = [...variants, newVariant];
    setVariants(newVariants);
    setSelectedVariantIndex(newVariants.length - 1);
    
    // Reset form fields for new variant
    resetVariantFields();
  };

  const deleteVariant = (index: number) => {
    if (variants.length <= 1) {
      alert("Cannot delete the last variant. A product must have at least one variant.");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this variant?")) {
      return;
    }
    
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
    
    // Adjust selected index if necessary
    if (selectedVariantIndex >= newVariants.length) {
      setSelectedVariantIndex(newVariants.length - 1);
    } else if (selectedVariantIndex > index) {
      setSelectedVariantIndex(selectedVariantIndex - 1);
    }
    
    // Load data for the new selected variant
    if (newVariants.length > 0) {
      loadVariantData(newVariants[selectedVariantIndex >= newVariants.length ? newVariants.length - 1 : selectedVariantIndex]);
    }
  };

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
      
      // Load SEO data
      setSeoTitle(product.seo?.meta_title || "");
      setSeoDescription(product.seo?.meta_description || "");
      setSeoKeywords(product.seo?.keywords?.join(", ") || "");
      
      // Load Media data (handle both MACH structure and flat JSON)
      const loadImageData = (imageField: any) => {
        if (!imageField) return { url: "", alt: "" };
        
        // Parse JSON string if needed
        let imageData = imageField;
        if (typeof imageField === "string" && imageField.startsWith("{")) {
          try {
            imageData = JSON.parse(imageField);
          } catch {
            return { url: "", alt: "" };
          }
        }
        
        // Handle MACH structure (file.url, accessibility.alt_text)
        if (imageData?.file?.url) {
          return {
            url: imageData.file.url,
            alt: imageData.accessibility?.alt_text || ""
          };
        }
        
        // Handle flat structure (url, alt_text)
        if (imageData?.url) {
          return {
            url: imageData.url,
            alt: imageData.alt_text || imageData.alt || ""
          };
        }
        
        return { url: "", alt: "" };
      };
      
      const primaryImage = loadImageData(product.primary_image);
      setPrimaryImageUrl(primaryImage.url);
      setPrimaryImageAlt(primaryImage.alt);
      
      const mediaUrls = product.media ? product.media.map((mediaItem: any) => {
        const mediaData = loadImageData(mediaItem);
        return mediaData.url;
      }).filter(Boolean).join("\n") : "";
      setMediaUrls(mediaUrls);
      
      // Load Rating data
      setRatingAverage(product.rating?.average?.toString() || "");
      setRatingCount(product.rating?.count?.toString() || "");
      
      // Load Related products and External references
      setRelatedProducts(product.related_products?.join(", ") || "");
      const extRefs = product.external_references ? 
        Object.entries(product.external_references).map(([key, value]) => `${key}:${value}`).join("\n") : "";
      setExternalReferences(extRefs);
      
      // Load Product type and timestamps
      setProductType(product.type || "");
      setCreatedAt(product.created_at || "");
      setUpdatedAt(product.updated_at || "");
      
      // Load Product options and extensions
      const optionsJson = product.options ? JSON.stringify(product.options, null, 2) : "";
      setProductOptions(optionsJson);
      const extensionsJson = product.extensions ? JSON.stringify(product.extensions, null, 2) : "";
      setExtensions(extensionsJson);
      
      // Initialize variants
      setVariants(product.variants || []);
      setSelectedVariantIndex(0);
      
      // Load first variant data
      if (product.variants && product.variants.length > 0) {
        loadVariantData(product.variants[0]);
      } else {
        // No variants, reset variant fields
        resetVariantFields();
      }
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
      
      // Reset SEO fields
      setSeoTitle("");
      setSeoDescription("");
      setSeoKeywords("");
      
      // Reset Media fields
      setPrimaryImageUrl("");
      setPrimaryImageAlt("");
      setMediaUrls("");
      
      // Reset Rating fields
      setRatingAverage("");
      setRatingCount("");
      
      // Reset Related products and External references
      setRelatedProducts("");
      setExternalReferences("");
      
      // Reset Product type and timestamps
      setProductType("");
      setCreatedAt("");
      setUpdatedAt("");
      
      // Reset Product options and extensions
      setProductOptions("");
      setExtensions("");
      
      // Initialize with a default variant for new products
      const defaultVariant = {
        id: "new-variant-1",
        sku: "SKU-001",
        price: { amount: 0, currency: "USD" },
        option_values: [],
        status: "active" as const,
        inventory: { quantity: 0 },
        shipping_required: true
      };
      setVariants([defaultVariant]);
      setSelectedVariantIndex(0);
      resetVariantFields();
    }
  }, [product, isNew]);

  // Image upload functions
  const uploadImage = async (file: File, folder: 'products' | 'categories', filename: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('filename', filename);

    const response = await fetch('/api/admin/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error((error as any).error || 'Upload failed');
    }

    return await response.json();
  };

  const handlePrimaryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPrimary(true);
    try {
      // Generate filename from product name
      const filename = generateR2Filename(name || 'product', 'primary');
      
      const result = await uploadImage(file, 'products', filename);
      setPrimaryImageUrl((result as any).path); // Store the database path format (/products/filename.jpg)
      
      // Reset the input
      event.target.value = '';
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingPrimary(false);
    }
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const filename = generateR2Filename(name || 'product', `${index + 1}`);
        const result = await uploadImage(file, 'products', filename);
        return (result as any).path;
      });

      const uploadedPaths = await Promise.all(uploadPromises);
      
      // Append to existing media URLs
      const currentUrls = mediaUrls.split('\n').filter(Boolean);
      const newUrls = [...currentUrls, ...uploadedPaths].join('\n');
      setMediaUrls(newUrls);
      
      // Reset the input
      event.target.value = '';
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save current variant data before saving
      if (variants.length > 0 && selectedVariantIndex < variants.length) {
        saveCurrentVariantData();
      }

      const productData: Partial<Product> = {
        ...(product?.id && !isNew ? { id: product.id } : {}), // Include ID for existing products
        name: name.trim(),
        description: description.trim() || undefined,
        slug: slug.trim() || undefined,
        brand: brand.trim() || undefined,
        status,
        categories,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        fulfillment_type: fulfillmentType,
        tax_category: taxCategory.trim() || undefined,
        type: productType.trim() || undefined,
      };

      // Add SEO data
      if (seoTitle || seoDescription || seoKeywords) {
        productData.seo = {
          meta_title: seoTitle.trim() || undefined,
          meta_description: seoDescription.trim() || undefined,
          keywords: seoKeywords ? seoKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined
        };
      }

      // Add Media data (MACH compliant structure)
      if (primaryImageUrl) {
        const urlTrimmed = primaryImageUrl.trim();
        const format = urlTrimmed.split('.').pop()?.toLowerCase() || 'jpg';
        
        productData.primary_image = {
          type: "image" as const,
          file: {
            url: urlTrimmed,
            format: format
          },
          accessibility: {
            alt_text: primaryImageAlt.trim() || undefined
          }
        };
      }

      if (mediaUrls) {
        const mediaList = mediaUrls.split("\n")
          .map(url => url.trim())
          .filter(Boolean)
          .map(url => {
            const format = url.split('.').pop()?.toLowerCase() || 'jpg';
            const type = url.match(/\.(mp4|webm|mov)$/i) ? "video" as const : 
                        url.match(/\.(pdf|doc|docx)$/i) ? "document" as const : "image" as const;
            
            return {
              type,
              file: {
                url,
                format
              }
            };
          });
        
        if (mediaList.length > 0) {
          productData.media = mediaList;
        }
      }

      // Add Rating data (both values required)
      if (ratingAverage && ratingCount) {
        const avgNum = parseFloat(ratingAverage);
        const countNum = parseInt(ratingCount);
        if (!isNaN(avgNum) && !isNaN(countNum) && avgNum >= 0 && avgNum <= 5 && countNum >= 0) {
          productData.rating = {
            average: avgNum,
            count: countNum
          };
        }
      }

      // Add Related products
      if (relatedProducts) {
        const relatedList = relatedProducts.split(",")
          .map(id => id.trim())
          .filter(Boolean);
        if (relatedList.length > 0) {
          productData.related_products = relatedList;
        }
      }

      // Add External references
      if (externalReferences) {
        const extRefs: Record<string, string> = {};
        externalReferences.split("\n")
          .map(line => line.trim())
          .filter(Boolean)
          .forEach(line => {
            const [key, ...valueParts] = line.split(":");
            if (key && valueParts.length > 0) {
              extRefs[key.trim()] = valueParts.join(":").trim();
            }
          });
        
        if (Object.keys(extRefs).length > 0) {
          productData.external_references = extRefs;
        }
      }

      // Add Product Options
      if (productOptions) {
        try {
          const optionsData = JSON.parse(productOptions);
          if (Array.isArray(optionsData) && optionsData.length > 0) {
            productData.options = optionsData;
          }
        } catch (error) {
          console.warn("Invalid JSON in product options:", error);
        }
      }

      // Add Extensions
      if (extensions) {
        try {
          const extensionsData = JSON.parse(extensions);
          if (typeof extensionsData === 'object' && extensionsData !== null && Object.keys(extensionsData).length > 0) {
            productData.extensions = extensionsData;
          }
        } catch (error) {
          console.warn("Invalid JSON in extensions:", error);
        }
      }

      // Add all variants data
      if (variants.length > 0) {
        productData.variants = variants;
        // Set default variant to first variant
        productData.default_variant_id = variants[0]?.id;
      } else if (isNew) {
        // For new products without variants, create a default variant
        const defaultVariant = {
          id: `variant_${Date.now()}`,
          sku: sku || `SKU_${Date.now()}`,
          price: price ? { amount: Math.round(parseFloat(price) * 100), currency: "USD" } : { amount: 0, currency: "USD" },
          option_values: [],
          inventory: inventory ? { quantity: parseInt(inventory) || 0, status: "in_stock" } : { quantity: 0, status: "out_of_stock" },
          status: "active" as const,
          shipping_required: true
        };
        productData.variants = [defaultVariant];
        productData.default_variant_id = defaultVariant.id;
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
            
            {/* Product Type and Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Type
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="">Select type...</option>
                  <option value="simple">Simple Product</option>
                  <option value="configurable">Configurable Product</option>
                  <option value="bundle">Bundle</option>
                  <option value="digital">Digital Product</option>
                  <option value="subscription">Subscription</option>
                  <option value="service">Service</option>
                </select>
                <div className="text-xs text-gray-400 mt-1">
                  Classification for product management
                </div>
              </div>
              
              {!isNew && createdAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Created
                  </label>
                  <div className="bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-gray-400 text-sm">
                    {new Date(createdAt).toLocaleString()}
                  </div>
                </div>
              )}
              
              {!isNew && updatedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Last Updated
                  </label>
                  <div className="bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-gray-400 text-sm">
                    {new Date(updatedAt).toLocaleString()}
                  </div>
                </div>
              )}
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

          {/* SEO */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Search className="w-4 h-4 mr-2" />
              SEO & Search Optimization
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Meta Title
                </label>
                <Input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Custom page title for search engines"
                  className="bg-neutral-700 border-neutral-600"
                  maxLength={60}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {seoTitle.length}/60 characters (optimal: 50-60)
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Meta Description
                </label>
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Brief description for search engine results"
                  className="bg-neutral-700 border-neutral-600"
                  rows={3}
                  maxLength={160}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {seoDescription.length}/160 characters (optimal: 150-160)
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SEO Keywords (comma-separated)
                </label>
                <Input
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="tactical gear, backpack, military, outdoor"
                  className="bg-neutral-700 border-neutral-600"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Add relevant keywords to help customers find this product
                </div>
              </div>
            </div>
          </div>

          {/* Media & Images */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <ImageIcon className="w-4 h-4 mr-2" />
              Images & Media
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Image
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      value={primaryImageUrl}
                      onChange={(e) => setPrimaryImageUrl(e.target.value)}
                      placeholder="/products/product-name.jpg or full URL"
                      className="bg-neutral-700 border-neutral-600"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Path or URL for the main product image
                    </div>
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handlePrimaryImageUpload}
                        className="hidden"
                        id="primary-image-upload"
                        disabled={uploadingPrimary}
                      />
                      <label
                        htmlFor="primary-image-upload"
                        className={`flex items-center justify-center px-4 py-2 border border-orange-500 rounded-md cursor-pointer transition-colors ${
                          uploadingPrimary
                            ? 'bg-orange-600/20 text-orange-300 cursor-not-allowed'
                            : 'text-orange-500 hover:bg-orange-500 hover:text-black'
                        }`}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingPrimary ? 'Uploading...' : 'Upload Image'}
                      </label>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Upload to R2 bucket (JPEG, PNG, WebP, max 10MB)
                    </div>
                  </div>
                </div>
                {primaryImageUrl && (
                  <div className="mt-3">
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-neutral-600">
                      <Image
                        src={primaryImageUrl.startsWith("/") ? primaryImageUrl : `/${primaryImageUrl}`}
                        alt={primaryImageAlt || "Primary image preview"}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Preview: {primaryImageUrl}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Image Alt Text
                </label>
                <Input
                  value={primaryImageAlt}
                  onChange={(e) => setPrimaryImageAlt(e.target.value)}
                  placeholder="Descriptive text for accessibility and SEO"
                  className="bg-neutral-700 border-neutral-600"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Describe the image for screen readers and search engines
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Additional Media
                </label>
                <div className="space-y-3">
                  <Textarea
                    value={mediaUrls}
                    onChange={(e) => setMediaUrls(e.target.value)}
                    placeholder="/products/image-2.jpg\n/products/video-demo.mp4\n/products/manual.pdf"
                    className="bg-neutral-700 border-neutral-600 font-mono text-sm"
                    rows={3}
                  />
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleMediaUpload}
                        className="hidden"
                        id="media-upload"
                        multiple
                        disabled={uploadingMedia}
                      />
                      <label
                        htmlFor="media-upload"
                        className={`flex items-center px-3 py-2 border border-green-500 rounded-md cursor-pointer transition-colors text-sm ${
                          uploadingMedia
                            ? 'bg-green-600/20 text-green-300 cursor-not-allowed'
                            : 'text-green-500 hover:bg-green-500 hover:text-black'
                        }`}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {uploadingMedia ? 'Uploading...' : 'Upload Images'}
                      </label>
                    </div>
                    <div className="text-xs text-gray-400">
                      Upload multiple images to R2 bucket (max 10MB each)
                    </div>
                  </div>
                  {mediaUrls && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                      {mediaUrls.split('\n').filter(Boolean).map((url, index) => {
                        const cleanUrl = url.trim();
                        const isImage = cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                        
                        return (
                          <div key={index} className="relative group">
                            {isImage ? (
                              <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-neutral-600 bg-neutral-800">
                                <Image
                                  src={cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`}
                                  alt={`Media ${index + 1}`}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              </div>
                            ) : (
                              <div className="relative w-full aspect-square rounded-lg border border-neutral-600 bg-neutral-800 flex items-center justify-center">
                                <div className="text-center">
                                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                  <div className="text-xs text-gray-400 truncate px-2">
                                    {cleanUrl.split('/').pop()}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const urls = mediaUrls.split('\n').filter(Boolean);
                                  urls.splice(index, 1);
                                  setMediaUrls(urls.join('\n'));
                                }}
                                className="w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {cleanUrl}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rating & Reviews */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Star className="w-4 h-4 mr-2" />
              Customer Reviews & Rating
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Average Rating (0-5)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={ratingAverage}
                  onChange={(e) => setRatingAverage(e.target.value)}
                  placeholder="4.5"
                  className="bg-neutral-700 border-neutral-600"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Aggregated customer rating from reviews
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Review Count
                </label>
                <Input
                  type="number"
                  min="0"
                  value={ratingCount}
                  onChange={(e) => setRatingCount(e.target.value)}
                  placeholder="127"
                  className="bg-neutral-700 border-neutral-600"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Total number of customer reviews
                </div>
              </div>
            </div>
          </div>

          {/* Related Products & External References */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Link className="w-4 h-4 mr-2" />
              Product Relationships
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Related Products (comma-separated IDs)
                </label>
                <Input
                  value={relatedProducts}
                  onChange={(e) => setRelatedProducts(e.target.value)}
                  placeholder="PROD-001, PROD-002, TACTICAL-PACK-XL"
                  className="bg-neutral-700 border-neutral-600"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Product IDs for "You might also like" recommendations
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  External System References (key:value per line)
                </label>
                <Textarea
                  value={externalReferences}
                  onChange={(e) => setExternalReferences(e.target.value)}
                  placeholder="erp_id:ERP-12345\npim_id:PIM-67890\nsku_legacy:OLD-SKU-001\nwarehouse_id:WH-999"
                  className="bg-neutral-700 border-neutral-600 font-mono text-sm"
                  rows={4}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Cross-system identifiers for integration (ERP, PIM, warehouse, etc.)
                </div>
              </div>
            </div>
          </div>

          {/* Product Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Product Options & Variant Generation
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Options Configuration (JSON)
              </label>
              <Textarea
                value={productOptions}
                onChange={(e) => setProductOptions(e.target.value)}
                placeholder='[{"id": "color", "name": "Color", "values": ["Red", "Blue", "Green"]}, {"id": "size", "name": "Size", "values": ["S", "M", "L", "XL"]}]'
                className="bg-neutral-700 border-neutral-600 font-mono text-sm"
                rows={6}
              />
              <div className="text-xs text-gray-400 mt-1">
                Define option types (Color, Size, etc.) that generate product variants. Each option creates variant combinations.
              </div>
            </div>
          </div>

          {/* Extensions & Custom Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Extensions & Custom Fields
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custom Extensions (JSON)
              </label>
              <Textarea
                value={extensions}
                onChange={(e) => setExtensions(e.target.value)}
                placeholder='{"warranty": "2 years", "certifications": ["ISO-9001"], "custom_fields": {"material_origin": "USA"}}'
                className="bg-neutral-700 border-neutral-600 font-mono text-sm"
                rows={5}
              />
              <div className="text-xs text-gray-400 mt-1">
                Additional custom data fields and business-specific metadata for this product.
              </div>
            </div>
          </div>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Package className="w-4 h-4 mr-2" />
                Product Variants ({variants.length})
              </h3>
              
              <div className="flex flex-wrap gap-2">
                {variants.map((variant, index) => {
                  const variantName = variant.sku || `Variant ${index + 1}`;
                  const isSelected = selectedVariantIndex === index;
                  
                  return (
                    <button
                      key={variant.id || index}
                      onClick={() => handleVariantSwitch(index)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isSelected 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
                      }`}
                    >
                      {variantName}
                      {variant.inventory?.quantity !== undefined && (
                        <span className="ml-2 text-xs opacity-80">
                          (Qty: {variant.inventory.quantity})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Variant Management Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    onClick={addNewVariant}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Variant
                  </Button>
                  
                  {variants.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => deleteVariant(selectedVariantIndex)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Current
                    </Button>
                  )}
                </div>
                
                {variants.length > 0 && (
                  <div className="text-sm text-gray-400">
                    Editing: <span className="text-orange-400 font-medium">
                      {variants[selectedVariantIndex]?.sku || `Variant ${selectedVariantIndex + 1}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing & Inventory */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              {variants.length > 1 ? 'Variant Pricing & Inventory' : 'Pricing & Inventory'}
            </h3>
            
            {/* Basic Pricing Fields */}
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
                  Compare At Price ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cost ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
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
            </div>
            
            {/* Inventory & Physical Properties */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Barcode/UPC
                </label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="123456789012"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Variant Status
                </label>
                <select
                  value={variantStatus}
                  onChange={(e) => setVariantStatus(e.target.value as any)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>
            
            {/* Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dimensions (L×W×H in)
                </label>
                <Input
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="12×8×4"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Shipping Required
                </label>
                <select
                  value={shippingRequired ? "true" : "false"}
                  onChange={(e) => setShippingRequired(e.target.value === "true")}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Position Order
                </label>
                <Input
                  type="number"
                  value={variantPosition}
                  onChange={(e) => setVariantPosition(e.target.value)}
                  placeholder="1"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
            
            {/* Variant Attributes JSON Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Variant Attributes (JSON)
              </label>
              <textarea
                value={variantAttributes}
                onChange={(e) => setVariantAttributes(e.target.value)}
                placeholder='{"color": "Olive Drab", "capacity": "10L", "material": "Cordura nylon"}'
                rows={4}
                className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white font-mono text-sm"
              />
              <div className="text-xs text-gray-400 mt-1">
                Store additional variant-specific properties as JSON. Examples: color, size, material, capacity
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