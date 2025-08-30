
/**
 * Get a product by its slug (MACH-compliant)
 * @param slug - The URL-friendly product identifier
 * @returns Promise<Product | null>
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getDb();
  
  // Get the product first
  const results = await db.select().from(products);
  const match = results.find((p: any) => {
    if (!p.slug) return false;
    if (typeof p.slug === 'string') return p.slug === slug;
    if (typeof p.slug === 'object' && p.slug !== null) {
      return Object.values(p.slug).includes(slug);
    }
    return false;
  });
  
  if (!match) return null;
  
  // Get the product variants
  const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, match.id));
  
  // Deserialize the product and include variants
  const product = deserializeProduct(match);
  product.variants = variants.map((v: any) => {
    try {
      // Helper function to parse price or inventory fields that might be JSON strings or plain numbers
      const parseMoneyField = (field: any) => {
        if (!field) return { amount: 0, currency: 'USD' };
        if (typeof field === 'object') return field;
        if (typeof field === 'string') {
          if (field.startsWith('{')) {
            return JSON.parse(field);
          }
          // Handle legacy string number format
          const amount = parseInt(field, 10);
          return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
        }
        if (typeof field === 'number') {
          return { amount: field, currency: 'USD' };
        }
        return { amount: 0, currency: 'USD' };
      };
      
      const parseInventoryField = (field: any) => {
        if (!field) return { quantity: 0, status: 'out_of_stock' };
        if (typeof field === 'object') return field;
        if (typeof field === 'string') {
          if (field.startsWith('{')) {
            return JSON.parse(field);
          }
          // Handle legacy string number format
          const quantity = parseInt(field, 10);
          return { 
            quantity: isNaN(quantity) ? 0 : quantity, 
            status: quantity > 0 ? 'in_stock' : 'out_of_stock' 
          };
        }
        if (typeof field === 'number') {
          return { quantity: field, status: field > 0 ? 'in_stock' : 'out_of_stock' };
        }
        return { quantity: 0, status: 'out_of_stock' };
      };
      
      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
        price: parseMoneyField(v.price),
        status: v.status || 'active',
        position: v.position || 0,
        compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : undefined,
        cost: v.cost ? parseMoneyField(v.cost) : undefined,
        weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : undefined,
        dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : undefined,
        barcode: v.barcode,
        inventory: parseInventoryField(v.inventory),
        tax_category: v.tax_category,
        shipping_required: v.shipping_required !== 0,
        media: v.media ? (typeof v.media === 'string' ? JSON.parse(v.media) : v.media) : [],
        attributes: v.attributes ? (typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes) : {},
        created_at: v.created_at,
        updated_at: v.updated_at
      };
    } catch (error) {
      console.error(`Error parsing variant data for variant ${v.id}:`, error, v);
      // Return a default variant structure if parsing fails, using basic parsing for critical fields
      const fallbackPrice = typeof v.price === 'string' && !v.price.startsWith('{') ? 
        { amount: parseInt(v.price, 10) || 0, currency: 'USD' } : 
        { amount: 0, currency: 'USD' };
      const fallbackInventory = typeof v.inventory === 'string' && !v.inventory.startsWith('{') ?
        { quantity: parseInt(v.inventory, 10) || 0, status: (parseInt(v.inventory, 10) || 0) > 0 ? 'in_stock' : 'out_of_stock' } :
        { quantity: 0, status: 'out_of_stock' };
        
      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        option_values: [],
        price: fallbackPrice,
        status: 'active',
        position: 0,
        compare_at_price: null,
        cost: null,
        weight: null,
        dimensions: null,
        barcode: v.barcode,
        inventory: fallbackInventory,
        tax_category: v.tax_category,
        shipping_required: false,
        media: [],
        attributes: {},
        created_at: v.created_at,
        updated_at: v.updated_at
      };
    }
  });
  
  return product;
}
/**
 * MACH Alliance Product Entity - Business Model
 * Core business logic for Product and ProductVariant management
 */

import { eq, and, like, inArray } from 'drizzle-orm';
import type {Product, ProductVariant, Money } from '@/lib/types/';
import { products, product_variants, deserializeProduct, serializeProduct } from '../../db/schema/products';
import { validateProduct, validateProductVariant, transformProductForDB, transformVariantForDB } from '../../db/schema/products';
import { getDbAsync } from '../../db';

// Helper function to get database instance (consistent pattern)
async function getDb() {
  return await getDbAsync();
}

/**
 * Core Product CRUD Operations
 */

export async function createProduct(productData: Product): Promise<Product> {
  if (!validateProduct(productData)) {
    throw new Error('Invalid product data provided');
  }

    const product = serializeProduct(productData);
  
  await (await getDb()).insert(products).values(product);
  return productData;
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  const result = await db.select().from(products).where(eq(products.id, id));
  
  if (!result[0]) return null;
  
  const product = deserializeProduct(result[0]);
  
  // Load variants for the product (same logic as listProducts and getProductBySlug)
  const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, product.id));
  
  product.variants = variants.map((v: any) => {
    try {
      // Helper function to parse price or inventory fields that might be JSON strings or plain numbers
      const parseMoneyField = (field: any) => {
        if (!field) return { amount: 0, currency: 'USD' };
        if (typeof field === 'object') return field;
        if (typeof field === 'string') {
          if (field.startsWith('{')) {
            return JSON.parse(field);
          }
          // Handle legacy string number format
          const amount = parseInt(field, 10);
          return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
        }
        if (typeof field === 'number') {
          return { amount: field, currency: 'USD' };
        }
        return { amount: 0, currency: 'USD' };
      };
      
      const parseInventoryField = (field: any) => {
        if (!field) return { quantity: 0, status: 'out_of_stock' };
        if (typeof field === 'object') return field;
        if (typeof field === 'string') {
          if (field.startsWith('{')) {
            return JSON.parse(field);
          }
          // Handle legacy string number format
          const quantity = parseInt(field, 10);
          return { 
            quantity: isNaN(quantity) ? 0 : quantity, 
            status: quantity > 0 ? 'in_stock' : 'out_of_stock' 
          };
        }
        if (typeof field === 'number') {
          return { quantity: field, status: field > 0 ? 'in_stock' : 'out_of_stock' };
        }
        return { quantity: 0, status: 'out_of_stock' };
      };
      
      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
        price: parseMoneyField(v.price),
        status: v.status || 'active',
        position: v.position || 0,
        compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : undefined,
        cost: v.cost ? parseMoneyField(v.cost) : undefined,
        weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : undefined,
        dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : undefined,
        barcode: v.barcode,
        inventory: parseInventoryField(v.inventory),
        tax_category: v.tax_category,
        shipping_required: v.shipping_required !== 0,
        media: v.media ? (typeof v.media === 'string' ? JSON.parse(v.media) : v.media) : [],
        attributes: v.attributes ? (typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes) : {},
        created_at: v.created_at,
        updated_at: v.updated_at
      } as ProductVariant;
    } catch (error) {
      console.error('Error parsing variant for product', product.id, ':', error);
      // Fallback values for failed parsing
      const fallbackPrice = typeof v.price === 'string' && !v.price.startsWith('{') ? 
        { amount: parseInt(v.price, 10) || 0, currency: 'USD' } : 
        { amount: 0, currency: 'USD' };
      const fallbackInventory = typeof v.inventory === 'string' && !v.inventory.startsWith('{') ?
        { quantity: parseInt(v.inventory, 10) || 0, status: (parseInt(v.inventory, 10) || 0) > 0 ? 'in_stock' : 'out_of_stock' } :
        { quantity: 0, status: 'out_of_stock' };
        
      return {
        id: v.id,
        product_id: v.product_id,
        sku: v.sku,
        option_values: [],
        price: fallbackPrice,
        status: v.status || 'active',
        position: v.position || 0,
        compare_at_price: undefined,
        cost: undefined,
        weight: undefined,
        dimensions: undefined,
        barcode: v.barcode,
        inventory: fallbackInventory,
        tax_category: v.tax_category,
        shipping_required: false,
        media: [],
        attributes: {},
        created_at: v.created_at,
        updated_at: v.updated_at
      } as ProductVariant;
    }
  });
  
  return product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const db = await getDb();
  
  // Extract variants from updates if present
  const { variants, ...productUpdates } = updates;
  
  // Update main product data
  const updateData = {
    ...serializeProduct({
      id: '',
      name: '',
      ...productUpdates
    } as Product),
    updated_at: new Date().toISOString()
  };

  await db.update(products).set(updateData).where(eq(products.id, id));
  
  // Update variants if provided
  if (variants && Array.isArray(variants)) {
    for (const variant of variants) {
      if (variant.id) {
        // Prepare variant update data
        const variantUpdateData: any = {
          updated_at: new Date().toISOString()
        };
        
        // Update inventory if provided
        if (variant.inventory) {
          variantUpdateData.inventory = JSON.stringify(variant.inventory);
        }
        
        // Update price if provided
        if (variant.price) {
          variantUpdateData.price = JSON.stringify(variant.price);
        }
        
        // Update SKU if provided
        if (variant.sku) {
          variantUpdateData.sku = variant.sku;
        }
        
        // Update weight if provided
        if (variant.weight) {
          variantUpdateData.weight = JSON.stringify(variant.weight);
        }
        
        // Update dimensions if provided
        if (variant.dimensions) {
          variantUpdateData.dimensions = JSON.stringify(variant.dimensions);
        }
        
        // Update barcode if provided
        if (variant.barcode) {
          variantUpdateData.barcode = variant.barcode;
        }
        
        // Update status if provided
        if (variant.status) {
          variantUpdateData.status = variant.status;
        }
        
        // Update position if provided
        if (variant.position !== undefined) {
          variantUpdateData.position = variant.position;
        }
        
        // Update compare_at_price if provided
        if (variant.compare_at_price) {
          variantUpdateData.compare_at_price = JSON.stringify(variant.compare_at_price);
        }
        
        // Update cost if provided
        if (variant.cost) {
          variantUpdateData.cost = JSON.stringify(variant.cost);
        }
        
        // Update tax_category if provided
        if (variant.tax_category) {
          variantUpdateData.tax_category = variant.tax_category;
        }
        
        // Update shipping_required if provided
        if (variant.shipping_required !== undefined) {
          variantUpdateData.shipping_required = variant.shipping_required ? 1 : 0;
        }
        
        // Update media if provided
        if (variant.media) {
          variantUpdateData.media = JSON.stringify(variant.media);
        }
        
        // Update attributes if provided
        if (variant.attributes) {
          variantUpdateData.attributes = JSON.stringify(variant.attributes);
        }
        
        // Update option_values if provided
        if (variant.option_values) {
          variantUpdateData.option_values = JSON.stringify(variant.option_values);
        }
        
        // Perform the update only if there are fields to update
        const fieldsToUpdate = Object.keys(variantUpdateData).filter(key => key !== 'updated_at');
        if (fieldsToUpdate.length > 0) {
          await db.update(product_variants)
            .set(variantUpdateData)
            .where(eq(product_variants.id, variant.id));
        }
      }
    }
  }
  
  return getProduct(id);
}

export async function deleteProduct(id: string): Promise<boolean> {
    const result = await (await getDb()).delete(products).where(eq(products.id, id));
  return result.meta.changes > 0;
}

export async function listProducts(options: {
  status?: ('active' | 'inactive' | 'archived' | 'draft')[];
  type?: string;
  brand?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Product[]> {
  const db = await getDb();
  const results = await db.select().from(products);
  let filteredResults = results.map(deserializeProduct);
  
  // Apply filters in memory
  if (options.status?.length) {
    filteredResults = filteredResults.filter(p => 
      options.status!.includes(p.status as any)
    );
  }
  
  if (options.type) {
    filteredResults = filteredResults.filter(p => p.type === options.type);
  }
  
  if (options.brand) {
    filteredResults = filteredResults.filter(p => p.brand === options.brand);
  }
  
  if (options.offset) {
    filteredResults = filteredResults.slice(options.offset);
  }
  
  if (options.limit) {
    filteredResults = filteredResults.slice(0, options.limit);
  }
  
  // Load variants for each product (reusing same logic as getProductBySlug)
  for (const product of filteredResults) {
    const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, product.id));
    
    product.variants = variants.map((v: any) => {
      try {
        // Helper function to parse price or inventory fields that might be JSON strings or plain numbers
        const parseMoneyField = (field: any) => {
          if (!field) return { amount: 0, currency: 'USD' };
          if (typeof field === 'object') return field;
          if (typeof field === 'string') {
            if (field.startsWith('{')) {
              return JSON.parse(field);
            }
            // Handle legacy string number format
            const amount = parseInt(field, 10);
            return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
          }
          if (typeof field === 'number') {
            return { amount: field, currency: 'USD' };
          }
          return { amount: 0, currency: 'USD' };
        };
        
        const parseInventoryField = (field: any) => {
          if (!field) return { quantity: 0, status: 'out_of_stock' };
          if (typeof field === 'object') return field;
          if (typeof field === 'string') {
            if (field.startsWith('{')) {
              return JSON.parse(field);
            }
            // Handle legacy string number format
            const quantity = parseInt(field, 10);
            return { 
              quantity: isNaN(quantity) ? 0 : quantity, 
              status: quantity > 0 ? 'in_stock' : 'out_of_stock' 
            };
          }
          if (typeof field === 'number') {
            return { quantity: field, status: field > 0 ? 'in_stock' : 'out_of_stock' };
          }
          return { quantity: 0, status: 'out_of_stock' };
        };
        
        return {
          id: v.id,
          product_id: v.product_id,
          sku: v.sku,
          option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
          price: parseMoneyField(v.price),
          status: v.status || 'active',
          position: v.position || 0,
          compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : undefined,
          cost: v.cost ? parseMoneyField(v.cost) : undefined,
          weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : undefined,
          dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : undefined,
          barcode: v.barcode,
          inventory: parseInventoryField(v.inventory),
          tax_category: v.tax_category,
          shipping_required: v.shipping_required !== 0,
          media: v.media ? (typeof v.media === 'string' ? JSON.parse(v.media) : v.media) : [],
          attributes: v.attributes ? (typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes) : {},
          created_at: v.created_at,
          updated_at: v.updated_at
        } as ProductVariant;
      } catch (error) {
        console.error('Error parsing variant for product', product.id, ':', error);
        // Fallback values for failed parsing
        const fallbackPrice = typeof v.price === 'string' && !v.price.startsWith('{') ? 
          { amount: parseInt(v.price, 10) || 0, currency: 'USD' } : 
          { amount: 0, currency: 'USD' };
        const fallbackInventory = typeof v.inventory === 'string' && !v.inventory.startsWith('{') ?
          { quantity: parseInt(v.inventory, 10) || 0, status: (parseInt(v.inventory, 10) || 0) > 0 ? 'in_stock' : 'out_of_stock' } :
          { quantity: 0, status: 'out_of_stock' };
          
        return {
          id: v.id,
          product_id: v.product_id,
          sku: v.sku,
          option_values: [],
          price: fallbackPrice,
          status: v.status || 'active',
          position: v.position || 0,
          compare_at_price: undefined,
          cost: undefined,
          weight: undefined,
          dimensions: undefined,
          barcode: v.barcode,
          inventory: fallbackInventory,
          tax_category: v.tax_category,
          shipping_required: false,
          media: [],
          attributes: {},
          created_at: v.created_at,
          updated_at: v.updated_at
        } as ProductVariant;
      }
    });
  }
  
  return filteredResults;
}

/**
 * Product Variant Operations
 */

export async function createProductVariant(variantData: ProductVariant): Promise<ProductVariant> {
  if (!validateProductVariant(variantData)) {
    throw new Error('Invalid product variant data provided');
  }
  
  if (!variantData.product_id) {
    throw new Error('Product ID is required for variant creation');
  }

    const variant = transformVariantForDB(variantData);
  
  await (await getDb()).insert(product_variants).values({
    ...variant,
    product_id: variant.product_id!
  });
  
  return variant;
}

export async function getProductVariant(id: string): Promise<ProductVariant | null> {
    const result = await (await getDb()).select().from(product_variants).where(eq(product_variants.id, id));
  return result[0] as ProductVariant || null;
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
    const results = await (await getDb()).select()
    .from(product_variants)
    .where(eq(product_variants.product_id, productId));
  return results as ProductVariant[];
}

export async function getVariantBySKU(sku: string): Promise<ProductVariant | null> {
    const result = await (await getDb()).select().from(product_variants).where(eq(product_variants.sku, sku));
  return result[0] as ProductVariant || null;
}

export async function updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | null> {
    const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  await (await getDb()).update(product_variants).set(updateData).where(eq(product_variants.id, id));
  return getProductVariant(id);
}

export async function deleteProductVariant(id: string): Promise<boolean> {
    const result = await (await getDb()).delete(product_variants).where(eq(product_variants.id, id));
  return result.meta.changes > 0;
}

/**
 * Product Search Operations
 */

export async function searchProducts(searchTerm: string): Promise<Product[]> {
    const results = await (await getDb()).select()
    .from(products)
    .where(like(products.name, `%${searchTerm}%`));
  return results.map(deserializeProduct);
}

export async function getProductsByBrand(brand: string): Promise<Product[]> {
    const results = await (await getDb()).select()
    .from(products)
    .where(eq(products.brand, brand));
  return results.map(deserializeProduct);
}

export async function getProductsByCategory(categoryIdentifier: string): Promise<Product[]> {
  const db = await getDb();
  const results = await db.select().from(products);
  const deserializedResults = results.map(deserializeProduct);
  
  // Filter products that have the category in their categories array
  // categoryIdentifier can be either a category ID (cat_1) or slug (featured)
  const filteredResults = deserializedResults.filter(product => {
    if (!product.categories || !Array.isArray(product.categories)) {
      return false;
    }
    return product.categories.includes(categoryIdentifier);
  });
  
  // Load variants for each filtered product
  for (const product of filteredResults) {
    const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, product.id));
    
    product.variants = variants.map((v: any) => {
      try {
        // Helper function to parse price or inventory fields that might be JSON strings or plain numbers
        const parseMoneyField = (field: any) => {
          if (!field) return { amount: 0, currency: 'USD' };
          if (typeof field === 'object') return field;
          if (typeof field === 'string') {
            if (field.startsWith('{')) {
              return JSON.parse(field);
            }
            // Handle legacy string number format
            const amount = parseInt(field, 10);
            return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
          }
          if (typeof field === 'number') {
            return { amount: field, currency: 'USD' };
          }
          return { amount: 0, currency: 'USD' };
        };
        
        const parseInventoryField = (field: any) => {
          if (!field) return { quantity: 0, status: 'out_of_stock' };
          if (typeof field === 'object') return field;
          if (typeof field === 'string') {
            if (field.startsWith('{')) {
              return JSON.parse(field);
            }
            // Handle legacy string number format
            const quantity = parseInt(field, 10);
            return { 
              quantity: isNaN(quantity) ? 0 : quantity, 
              status: quantity > 0 ? 'in_stock' : 'out_of_stock' 
            };
          }
          if (typeof field === 'number') {
            return { quantity: field, status: field > 0 ? 'in_stock' : 'out_of_stock' };
          }
          return { quantity: 0, status: 'out_of_stock' };
        };
        
        return {
          id: v.id,
          product_id: v.product_id,
          sku: v.sku,
          option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
          price: parseMoneyField(v.price),
          status: v.status || 'active',
          position: v.position || 0,
          compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : undefined,
          cost: v.cost ? parseMoneyField(v.cost) : undefined,
          weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : undefined,
          dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : undefined,
          barcode: v.barcode,
          inventory: parseInventoryField(v.inventory),
          tax_category: v.tax_category,
          shipping_required: v.shipping_required !== 0,
          media: v.media ? (typeof v.media === 'string' ? JSON.parse(v.media) : v.media) : [],
          attributes: v.attributes ? (typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes) : {},
          created_at: v.created_at,
          updated_at: v.updated_at
        };
      } catch (error) {
        console.error(`Error parsing variant data for variant ${v.id}:`, error, v);
        // Return a default variant structure if parsing fails, using basic parsing for critical fields
        const fallbackPrice = typeof v.price === 'string' && !v.price.startsWith('{') ? 
          { amount: parseInt(v.price, 10) || 0, currency: 'USD' } : 
          { amount: 0, currency: 'USD' };
        const fallbackInventory = typeof v.inventory === 'string' && !v.inventory.startsWith('{') ?
          { quantity: parseInt(v.inventory, 10) || 0, status: (parseInt(v.inventory, 10) || 0) > 0 ? 'in_stock' : 'out_of_stock' } :
          { quantity: 0, status: 'out_of_stock' };
          
        return {
          id: v.id,
          product_id: v.product_id,
          sku: v.sku,
          option_values: [],
          price: fallbackPrice,
          status: 'active',
          position: 0,
          compare_at_price: null,
          cost: null,
          weight: null,
          dimensions: null,
          barcode: v.barcode,
          inventory: fallbackInventory,
          tax_category: v.tax_category,
          shipping_required: false,
          media: [],
          attributes: {},
          created_at: v.created_at,
          updated_at: v.updated_at
        };
      }
    });
  }
  
  return filteredResults;
}

export async function getActiveProducts(): Promise<Product[]> {
    const results = await (await getDb()).select()
    .from(products)
    .where(eq(products.status, 'active'));
  return results.map(deserializeProduct);
}

/**
 * Variant Selection Operations
 */

export async function getVariantByOptions(
  productId: string,
  selectedOptions: Record<string, string>
): Promise<ProductVariant | null> {
  const variants = await getProductVariants(productId);
  
  return variants.find(variant => {
    return variant.option_values.every(ov => 
      selectedOptions[ov.option_id] === ov.value
    );
  }) || null;
}

export async function getAvailableVariants(productId: string): Promise<ProductVariant[]> {
    const results = await (await getDb()).select()
    .from(product_variants)
    .where(and(
      eq(product_variants.product_id, productId),
      eq(product_variants.status, 'active')
    ));
  return results as ProductVariant[];
}

/**
 * Product Analytics
 */

export async function getProductStats(productId: string) {
  const product = await getProduct(productId);
  if (!product) return null;

  const variants = await getProductVariants(productId);
  const activeVariants = variants.filter(v => v.status === 'active');
  
  // Calculate price range
  const prices = variants.map(v => v.price.amount);
  const priceRange = prices.length > 0 ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
    currency: variants[0]?.price.currency || 'USD'
  } : null;

  return {
    product,
    totalVariants: variants.length,
    activeVariants: activeVariants.length,
    priceRange,
    hasMultipleOptions: (product.options?.length || 0) > 1,
    fulfillmentType: product.fulfillment_type
  };
}

/**
 * Bulk Operations
 */

export async function bulkUpdateProductStatus(
  productIds: string[],
  status: 'active' | 'inactive' | 'archived' | 'draft'
): Promise<number> {
    const result = await (await getDb()).update(products)
    .set({ 
      status,
      updated_at: new Date().toISOString()
    })
    .where(inArray(products.id, productIds));
  
  return result.meta.changes;
}

export async function bulkUpdateVariantPrices(
  updates: { id: string; price: Money }[]
): Promise<number> {
    let totalUpdated = 0;
  
  for (const update of updates) {
    const result = await (await getDb()).update(product_variants)
      .set({ 
        price: update.price,
        updated_at: new Date().toISOString()
      })
      .where(eq(product_variants.id, update.id));
    
    totalUpdated += result.meta.changes;
  }
  
  return totalUpdated;
}

/**
 * Product Relationships
 */

export async function addRelatedProduct(productId: string, relatedProductId: string): Promise<boolean> {
  const product = await getProduct(productId);
  if (!product) return false;

  const relatedProducts = product.related_products || [];
  if (relatedProducts.includes(relatedProductId)) return true;

  relatedProducts.push(relatedProductId);
  
  await updateProduct(productId, { related_products: relatedProducts });
  return true;
}

export async function removeRelatedProduct(productId: string, relatedProductId: string): Promise<boolean> {
  const product = await getProduct(productId);
  if (!product) return false;

  const relatedProducts = (product.related_products || []).filter(id => id !== relatedProductId);
  
  await updateProduct(productId, { related_products: relatedProducts });
  return true;
}

export async function getRelatedProducts(productId: string): Promise<Product[]> {
    const product = await getProduct(productId);
  if (!product || !product.related_products) return [];

  const results = await (await getDb()).select()
    .from(products)
    .where(inArray(products.id, product.related_products));
  return results.map(deserializeProduct);
}

/**
 * Utility Functions
 */

export async function getProductWithVariants(productId: string): Promise<{
  product: Product;
  variants: ProductVariant[];
} | null> {
  const product = await getProduct(productId);
  if (!product) return null;

  const variants = await getProductVariants(productId);
  
  return { product, variants };
}

export async function duplicateProduct(
  productId: string,
  newId: string,
  modifications: Partial<Product> = {}
): Promise<Product | null> {
  const original = await getProduct(productId);
  if (!original) return null;

  const duplicateData: Product = {
    ...original,
    id: newId,
    ...modifications,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return await createProduct(duplicateData);
}

/**
 * Helper to get the effective price (lowest sale or regular) for a product
 * Returns the price of the default variant, or the first variant if not set
 */
export function getEffectivePrice(product: Product): number {
  const variant = product.variants?.find((v) => v.id === product.default_variant_id) || product.variants?.[0];
  return variant?.price?.amount ?? Number.POSITIVE_INFINITY;
}