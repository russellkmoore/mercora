/**
 * === MACH Product Loaders ===
 * 
 * Production-ready product loaders that integrate MACH Products with Media entities
 * for complete product data including images, variants, and categories.
 * 
 * Features:
 * - MACH Alliance compliant data loading
 * - Media entity integration for product images  
 * - Category filtering and search
 * - Optimized for performance and SEO
 */

import { listProducts, getProduct } from "@/lib/models/mach/products";
import { getAllMedia } from "@/lib/models/mach/media";

export interface ProductWithImages {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  category?: string;
  status: "active" | "inactive" | "discontinued";
  attributes: Record<string, any>;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: Record<string, any>;
  }>;
  images: Array<{
    media_id: string;
    url: string;
    alt_text?: string;
    type: "primary" | "gallery";
    sort_order: number;
  }>;
  // Convenience fields for backward compatibility
  primaryImageUrl?: string;
  imageUrls: string[];
}

/**
 * Load products by category with full media integration
 */
export async function getProductsByCategory(categorySlug: string): Promise<ProductWithImages[]> {
  try {
    // Get products filtered by category
    const products = await listProducts({ 
      category: categorySlug,
      status: "active",
      limit: 50
    });

    // Enhance each product with media data
    const productsWithImages = await Promise.all(
      products.map(product => enhanceProductWithImages(product))
    );

    return productsWithImages.filter(Boolean) as ProductWithImages[];

  } catch (error) {
    console.error(`Error loading products for category ${categorySlug}:`, error);
    return [];
  }
}

/**
 * Load single product by SKU with full media integration
 */
export async function getProductBySku(sku: string): Promise<ProductWithImages | null> {
  try {
    // Get product by SKU
    const product = await getProduct(sku);
    
    if (!product) {
      return null;
    }

    // Enhance with media data
    return await enhanceProductWithImages(product);

  } catch (error) {
    console.error(`Error loading product by SKU ${sku}:`, error);
    return null;
  }
}

/**
 * Load single product by slug with full media integration
 * Uses the proper MACH schema slug field
 */
export async function getProductBySlug(slug: string): Promise<ProductWithImages | null> {
  try {
    // Get all products and find by slug (MACH schema has slug field)
    const products = await listProducts({ limit: 100 });
    const product = products.find(p => p.slug === slug);
    
    if (!product) {
      console.log(`No product found for slug: ${slug}`);
      return null;
    }

    // Enhance with media data
    return await enhanceProductWithImages(product);

  } catch (error) {
    console.error(`Error loading product by slug ${slug}:`, error);
    return null;
  }
}

/**
 * Load all active products with images (for product listing pages)
 */
export async function getAllActiveProducts(): Promise<ProductWithImages[]> {
  try {
    const products = await listProducts({ 
      status: "active",
      limit: 100 
    });

    const productsWithImages = await Promise.all(
      products.map(product => enhanceProductWithImages(product))
    );

    return productsWithImages.filter(Boolean) as ProductWithImages[];

  } catch (error) {
    console.error("Error loading all active products:", error);
    return [];
  }
}

/**
 * Enhance a MACH product with media entity data
 */
async function enhanceProductWithImages(product: any): Promise<ProductWithImages | null> {
  try {
    // Load media entities for this product
    const productImages = await getProductMediaReferences(product.id);

    // Build enhanced product object
    const enhanced: ProductWithImages = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      category: product.category,
      status: product.status,
      attributes: product.attributes || {},
      variants: product.variants || [],
      images: productImages,
      // Convenience fields
      primaryImageUrl: productImages.find(img => img.type === "primary")?.url,
      imageUrls: productImages.map(img => img.url),
    };

    return enhanced;

  } catch (error) {
    console.error(`Error enhancing product ${product.id} with images:`, error);
    return null;
  }
}

/**
 * Get media references for a specific product
 */
async function getProductMediaReferences(productId: string): Promise<Array<{
  media_id: string;
  url: string;
  alt_text?: string;
  type: "primary" | "gallery";
  sort_order: number;
}>> {
  try {
    // Get all media entities
    const allMedia = await getAllMedia({ limit: 100 });
    
    // Filter for this product and convert to product image format
    const productMedia = allMedia
      .filter(media => 
        media.external_references?.product_id === productId ||
        media.tags?.includes(`product-${productId}`)
      )
      .map((media, index) => ({
        media_id: media.id!,
        url: media.file.url,
        alt_text: media.accessibility?.alt_text,
        type: (index === 0 ? "primary" : "gallery") as "primary" | "gallery",
        sort_order: index,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    return productMedia;

  } catch (error) {
    console.error(`Error loading media for product ${productId}:`, error);
    return [];
  }
}
