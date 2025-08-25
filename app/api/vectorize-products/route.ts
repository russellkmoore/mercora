/**
 * === Enhanced Vectorize Products API ===
 *
 * This endpoint now performs a complete workflow:
 * 1. Queries products from the MACH-compliant database
 * 2. Includes AI notes from the extension table 
 * 3. Generates individual MD files per product
 * 4. Uploads them to R2 under the products_md/ prefix
 * 5. Embeds them using Cloudflare AI and stores in Vectorize
 *
 * This replaces the static MD file approach with a dynamic database-driven system
 * that automatically includes all product data and AI context for better search.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products, deserializeProduct, product_variants } from "@/lib/db/schema/products";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Get Cloudflare bindings directly
    const { env } = await getCloudflareContext({ async: true });
    const media = (env as any).MEDIA;
    const vectorize = (env as any).VECTORIZE;
    const ai = (env as any).AI;
    
    // Access environment variables/secrets through process.env
    const ADMIN_VECTORIZE_TOKEN = process.env.ADMIN_VECTORIZE_TOKEN;

    // Token check - allow bypass if no token is set (for development)
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    
    if (ADMIN_VECTORIZE_TOKEN && token !== ADMIN_VECTORIZE_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!media || !vectorize || !ai) {
      return NextResponse.json(
        { 
          error: "Missing required bindings", 
          available: {
            MEDIA: !!media,
            VECTORIZE: !!vectorize,
            AI: !!ai
          }
        },
        { status: 500 }
      );
    }

    // Get all products from the database using the schema
    const db = await getDbAsync();
    const allProducts = await db.select().from(products);

    console.log(`Found ${allProducts.length} products to process`);

    const results: string[] = [];
    const errors: string[] = [];

    for (const productRecord of allProducts) {
      try {
        // Get variants for this product
        const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, productRecord.id));
        
        // Deserialize the product
        const product = deserializeProduct(productRecord);
        
        // Parse and attach variants (using same logic as agent-chat)
        product.variants = variants.map((v: any) => {
          try {
            // Helper function to parse price or inventory fields
            const parseMoneyField = (field: any) => {
              if (!field) return { amount: 0, currency: 'USD' };
              if (typeof field === 'object') return field;
              if (typeof field === 'number') {
                return { amount: field, currency: 'USD' };
              }
              if (typeof field === 'string') {
                if (field.startsWith('{')) {
                  return JSON.parse(field);
                }
                const amount = parseInt(field, 10);
                return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
              }
              return { amount: 0, currency: 'USD' };
            };

            const parseInventoryField = (field: any) => {
              if (!field) return { quantity: 0, track: false };
              if (typeof field === 'object') return field;
              if (typeof field === 'string') {
                try {
                  return JSON.parse(field);
                } catch (e) {
                  return { quantity: 0, track: false };
                }
              }
              return { quantity: 0, track: false };
            };

            return {
              id: v.id,
              product_id: v.product_id,
              sku: v.sku,
              option_values: v.option_values ? (typeof v.option_values === 'string' ? JSON.parse(v.option_values) : v.option_values) : [],
              price: parseMoneyField(v.price),
              status: v.status || 'active',
              position: v.position || 0,
              compare_at_price: v.compare_at_price ? parseMoneyField(v.compare_at_price) : null,
              cost: v.cost ? parseMoneyField(v.cost) : null,
              weight: v.weight ? (typeof v.weight === 'string' ? JSON.parse(v.weight) : v.weight) : null,
              dimensions: v.dimensions ? (typeof v.dimensions === 'string' ? JSON.parse(v.dimensions) : v.dimensions) : null,
              barcode: v.barcode,
              inventory: parseInventoryField(v.inventory),
              tax_category: v.tax_category,
              attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes || '{}') : (v.attributes || {}),
              created_at: v.created_at,
              updated_at: v.updated_at
            };
          } catch (variantError) {
            console.error("Error parsing variant:", variantError);
            return v;
          }
        });

        // Map the product data for the markdown generator (with proper pricing)
        const mappedProduct = {
          id: product.id,
          sku: product.default_variant_id || product.id,
          name: typeof product.name === 'string' ? product.name : (product.name?.en || 'Unknown Product'),
          description: typeof product.description === 'string' ? product.description : 
                      (product.description?.en || JSON.stringify(product.description) || ''),
          pricing: {
            basePrice: product.variants?.[0]?.price?.amount ? product.variants[0].price.amount / 100 : 0,
            compareAtPrice: product.variants?.[0]?.compare_at_price?.amount ? product.variants[0].compare_at_price.amount / 100 : null
          },
          images: product.media || (product.primary_image ? [product.primary_image] : []),
          categories: product.categories || [],
          attributes: product.variants?.[0]?.attributes || {},
          tags: product.tags || [],
          useCases: product.extensions?.use_cases || [],
          aiNotes: product.extensions?.ai_notes || '',
          brand: product.brand || 'Mercora',
          rating: product.rating || {},
          relatedProducts: product.related_products || [],
          extensions: product.extensions || {},
          createdAt: product.created_at || new Date().toISOString(),
          updatedAt: product.updated_at || new Date().toISOString()
        };
        
        // Generate comprehensive markdown content
        const mdContent = generateProductMarkdown(mappedProduct);

        const productAny = product as any;
        const slug = productAny.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        if (!mdContent || mdContent.trim().length < 10) {
          errors.push(`Insufficient content generated for product ${productAny.id}`);
          continue;
        }

        // Upload to R2
        const fileName = `products_md/${slug}.md`;
        await media.put(fileName, mdContent, {
          httpMetadata: {
            contentType: 'text/markdown'
          }
        });

        // Embed with Cloudflare AI 
        const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text: mdContent });

        // Store vector in index - use product ID as vector ID for consistency
        await vectorize.upsert([
          {
            id: productAny.id,
            values: embedding.data[0],
            metadata: {
              slug,
              source: "product",
              text: mdContent.substring(0, 1000),
              productId: productAny.id,
            },
          },
        ]);

        results.push(`${slug} (ID: ${productAny.id})`);
        
      } catch (error) {
        const productAny = productRecord as any;
        errors.push(`Error processing product ${productAny.id}: ${error}`);
      }
    }

    const response = {
      success: true,
      message: `Vectorization complete. Generated and indexed ${results.length} products from database.`,
      totalProducts: allProducts.length,
      indexed: results,
      errors: errors.length > 0 ? errors : undefined,
      workflow: [
        "1. Queried products from MACH database",
        "2. Retrieved AI notes from extension table",
        "3. Generated markdown files with full product data",
        "4. Uploaded to R2 under products_md/ prefix",
        "5. Embedded and stored in Vectorize index"
      ]
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Vectorization error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// Debug endpoint to check raw variant data from database
export async function PATCH(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const productResults = await db.select().from(products).where(eq(products.id, 'prod_2')).limit(1);
    
    if (productResults.length === 0) {
      return NextResponse.json({ error: "Product not found" });
    }
    
    const productRecord = productResults[0];
    const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, productRecord.id));
    
    return NextResponse.json({
      message: "Raw database data for prod_2 Dusty Fire Tool",
      productRecord: productRecord,
      variants: variants,
      variantCount: variants.length,
      firstVariantPrice: variants[0]?.price,
      firstVariantPriceType: typeof variants[0]?.price,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({ 
      message: "Database debug ERROR", 
      error: String(error)
    });
  }
}

// Test endpoint to verify deployment and markdown generation
export async function OPTIONS(request: NextRequest) {
  try {
    // Get one product and test markdown generation
    const db = await getDbAsync();
    const productResults = await db.select().from(products).where(eq(products.id, 'prod_2')).limit(1);
    
    if (productResults.length === 0) {
      return NextResponse.json({ error: "Product not found" });
    }
    
    const productRecord = productResults[0];
    const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, productRecord.id));
    const product = deserializeProduct(productRecord);
    
    // Parse and attach variants (EXACT same logic as main GET)
    product.variants = variants.map((v: any) => {
      try {
        const parseMoneyField = (field: any) => {
          if (!field) return { amount: 0, currency: 'USD' };
          if (typeof field === 'object') return field;
          if (typeof field === 'number') {
            return { amount: field, currency: 'USD' };
          }
          if (typeof field === 'string') {
            if (field.startsWith('{')) {
              return JSON.parse(field);
            }
            const amount = parseInt(field, 10);
            return { amount: isNaN(amount) ? 0 : amount, currency: 'USD' };
          }
          return { amount: 0, currency: 'USD' };
        };

        return {
          ...v,
          price: parseMoneyField(v.price),
          compare_at_price: parseMoneyField(v.compare_at_price),
          attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes || '{}') : (v.attributes || {}),
          inventory: typeof v.inventory === 'string' ? JSON.parse(v.inventory || '{}') : (v.inventory || {}),
        };
      } catch (variantError) {
        return v;
      }
    });
    
    // Map the product data
    const mappedProduct = {
      id: product.id,
      sku: product.default_variant_id || product.id,
      name: typeof product.name === 'string' ? product.name : (product.name?.en || 'Unknown Product'),
      description: typeof product.description === 'string' ? product.description : 
                  (product.description?.en || JSON.stringify(product.description) || ''),
      pricing: {
        basePrice: product.variants?.[0]?.price?.amount ? product.variants[0].price.amount / 100 : 0,
        compareAtPrice: product.variants?.[0]?.compare_at_price?.amount ? product.variants[0].compare_at_price.amount / 100 : null
      },
      images: product.media || (product.primary_image ? [product.primary_image] : []),
      categories: product.categories || [],
      attributes: product.variants?.[0]?.attributes || {},
      tags: product.tags || [],
      useCases: product.extensions?.use_cases || [],
      aiNotes: product.extensions?.ai_notes || '',
      brand: product.brand || 'Mercora',
      rating: product.rating || {},
      relatedProducts: product.related_products || [],
      extensions: product.extensions || {},
      createdAt: product.created_at || new Date().toISOString(),
      updatedAt: product.updated_at || new Date().toISOString()
    };
    
    // Test markdown generation
    let mdContent: string;
    let error = null;
    
    try {
      mdContent = generateProductMarkdown(mappedProduct);
    } catch (mdError) {
      error = String(mdError);
      mdContent = `FALLBACK: generateProductMarkdown failed with: ${error}`;
    }
    
    return NextResponse.json({ 
      message: "Vectorize API v2.2 - Testing markdown generation with fixed variant parsing", 
      timestamp: new Date().toISOString(),
      rawVariant: variants[0],
      parsedVariant: product.variants?.[0],
      product: {
        id: product.id,
        name: product.name,
        pricing: mappedProduct.pricing,
        variantCount: product.variants?.length || 0
      },
      markdownLength: mdContent.length,
      markdownPreview: mdContent.substring(0, 500),
      error: error,
      success: !error
    });
    
  } catch (error) {
    return NextResponse.json({ 
      message: "Vectorize API v2.2 - ERROR", 
      timestamp: new Date().toISOString(),
      error: String(error)
    });
  }
}

function generateProductMarkdown(product: {
  id: string;
  sku: string;
  name: string;
  description: string;
  pricing: any;
  images: any[];
  categories: any[];
  attributes: any;
  tags?: string[];
  useCases?: string[];
  aiNotes?: string;
  brand?: string;
  rating?: any;
  relatedProducts?: string[];
  extensions?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}): string {
  const { id, sku, name, description, pricing, images, categories, attributes, tags = [], useCases = [], aiNotes = '', brand = '', rating = {}, relatedProducts = [], extensions = {}, createdAt, updatedAt } = product;

  // YAML frontmatter with all metadata
  let md = '---\n';
  md += 'id: ' + id + '\n';
  md += 'sku: ' + sku + '\n';
  md += 'name: ' + name + '\n';
  md += 'brand: ' + brand + '\n';
  md += 'created: ' + createdAt + '\n';
  md += 'updated: ' + updatedAt + '\n';
  if (pricing.basePrice) md += 'price: ' + pricing.basePrice + '\n';
  if (pricing.compareAtPrice && pricing.compareAtPrice > pricing.basePrice) md += 'sale_price: ' + pricing.basePrice + '\nregular_price: ' + pricing.compareAtPrice + '\n';
  if (Array.isArray(tags) && tags.length > 0) md += 'tags: [' + tags.map((t: string) => `'${t}'`).join(', ') + ']\n';
  if (Array.isArray(useCases) && useCases.length > 0) md += 'use_cases: [' + useCases.map((u: string) => `'${u}'`).join(', ') + ']\n';
  if (Array.isArray(categories) && categories.length > 0) md += 'categories: [' + categories.map((cat: any) => `'${cat.name?.en || cat.name}'`).join(', ') + ']\n';
  if (Array.isArray(relatedProducts) && relatedProducts.length > 0) md += 'related_products: [' + relatedProducts.map((r: string) => `'${r}'`).join(', ') + ']\n';
  if (rating.average) md += 'rating: ' + rating.average + '\n';
  if (rating.count) md += 'rating_count: ' + rating.count + '\n';
  // Add all extensions fields to frontmatter (except ai_notes/use_cases already handled)
  for (const [key, value] of Object.entries(extensions)) {
    if (key === 'ai_notes' || key === 'use_cases') continue;
    if (Array.isArray(value)) {
      md += key + ': [' + (value as any[]).map((v: any) => `'${v}'`).join(', ') + ']\n';
    } else if (typeof value === 'object' && value !== null) {
      md += key + ': ' + JSON.stringify(value) + '\n';
    } else {
      md += key + ": '" + value + "'\n";
    }
  }
  md += '---\n\n';

  md += '# ' + name + '\n\n';
  md += '## Product Information\n- **SKU**: ' + sku + '\n- **Product ID**: ' + id + '\n';
  if (brand) md += '- **Brand**: ' + brand + '\n';
  if (pricing.basePrice) {
    md += '- **Price**: $' + pricing.basePrice.toFixed(2);
    if (pricing.compareAtPrice && pricing.compareAtPrice > pricing.basePrice) {
      md += ' (On Sale! Regular $' + pricing.compareAtPrice.toFixed(2) + ')';
    }
    md += '\n';
  }
  if (categories && categories.length > 0) {
    md += '- **Categories**: ' + categories.map((cat: any) => cat.name?.en || cat.name).join(', ') + '\n';
  }
  if (tags.length > 0) {
    md += '- **Tags**: ' + tags.join(', ') + '\n';
  }
  if (useCases.length > 0) {
    md += '- **Use Cases**: ' + useCases.join(', ') + '\n';
  }
  if (relatedProducts.length > 0) {
    md += '- **Related Products**: ' + relatedProducts.join(', ') + '\n';
  }
  if (rating.average) {
    md += '- **Rating**: ' + rating.average + ' (' + (rating.count || 0) + ' reviews)\n';
  }

  // Add description
  if (description) {
    md += '\n## Description\n' + description + '\n';
  }

  // Add attributes/specifications
  if (attributes && Object.keys(attributes).length > 0) {
    md += '\n## Specifications\n';
    for (const [key, value] of Object.entries(attributes)) {
      md += '- **' + key + '**: ' + value + '\n';
    }
  }

  // Add images
  if (images && images.length > 0) {
    md += '\n## Images\n';
    images.forEach((img: any, index: number) => {
      md += (index + 1) + '. ' + img.url + (img.alt ? ' (' + img.alt + ')' : '') + '\n';
    });
  }

  // Add all extensions fields as sections (except ai_notes/use_cases)
  for (const [key, value] of Object.entries(extensions)) {
    if (key === 'ai_notes' || key === 'use_cases') continue;
    const heading = key.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    md += '\n## ' + heading + '\n';
    if (Array.isArray(value)) {
      value.forEach((v: any) => { md += '- ' + v + '\n'; });
    } else if (typeof value === 'object' && value !== null) {
      md += JSON.stringify(value, null, 2) + '\n';
    } else {
      md += value + '\n';
    }
  }

  // Add AI notes if present
  if (aiNotes && aiNotes.trim().length > 0) {
    md += '\n## AI Assistant Notes\n' + aiNotes + '\n';
  }

  return md;
}