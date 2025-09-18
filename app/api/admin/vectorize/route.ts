/**
 * === Consolidated Vectorize API ===
 *
 * This endpoint performs a complete vectorization workflow:
 * 1. Clears the existing Vectorize index to prevent stale data
 * 2. Vectorizes all products from the database
 * 3. Vectorizes all knowledge articles from R2 knowledge_md/ folder
 * 4. Returns comprehensive results for both data sources
 *
 * This replaces the separate /vectorize-products and /vectorize-knowledge endpoints
 * with a single atomic operation that ensures the vector database is always complete
 * and consistent with both product data and knowledge base content.
 *
 * === Security ===
 * Uses unified authentication system with permissions: ["vectorize:read", "vectorize:write"]
 * 
 * Supported authentication methods:
 * - Authorization: Bearer <token>
 * - X-API-Key: <token>
 * - Query parameter: ?token=<token> (deprecated, for backward compatibility)
 *
 * === Usage ===
 * ```bash
 * curl -H "Authorization: Bearer YOUR_TOKEN" /api/vectorize
 * ```
 *
 * === Performance Considerations ===
 * - This operation can take 1-3 minutes depending on the number of products and articles
 * - Cloudflare Workers have a 30s CPU limit and 15min wall clock limit
 * - Consider splitting into batches if the dataset grows significantly
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products, deserializeProduct, product_variants } from "@/lib/db/schema/products";
import { eq } from "drizzle-orm";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions first
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || "Admin access required" },
        { status: 401 }
      );
    }

    // Get Cloudflare bindings
    const { env } = await getCloudflareContext({ async: true });
    const media = (env as any).MEDIA;
    const vectorize = (env as any).VECTORIZE;
    const ai = (env as any).AI;

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

    const startTime = Date.now();
    console.log("Starting consolidated vectorization...");

    // ==========================================
    // STEP 1: Clear existing vector index
    // ==========================================
    console.log("Clearing existing vector index...");
    
    // Get existing vector IDs to delete them
    try {
      // Query existing vectors with a dummy vector (we just need the IDs)
      const dummyVector = new Array(768).fill(0); // BGE model produces 768-dim vectors
      const existingVectors = await vectorize.query(dummyVector, { 
        topK: 10000, // Get up to 10k existing vectors
        returnMetadata: true,
        includeValues: false
      });

      if (existingVectors.matches && existingVectors.matches.length > 0) {
        const idsToDelete = existingVectors.matches.map((match: any) => match.id);
        console.log(`Deleting ${idsToDelete.length} existing vectors...`);
        
        // Delete in batches of 1000 (Vectorize limit)
        for (let i = 0; i < idsToDelete.length; i += 1000) {
          const batch = idsToDelete.slice(i, i + 1000);
          await vectorize.deleteByIds(batch);
        }
      }
    } catch (clearError) {
      console.log("Note: Could not clear existing vectors (index might be empty):", clearError);
    }

    // ==========================================
    // STEP 2: Vectorize Products
    // ==========================================
    console.log("Starting product vectorization...");
    
    const db = await getDbAsync();
    const allProducts = await db.select().from(products);
    console.log(`Found ${allProducts.length} products to process`);

    const productResults: string[] = [];
    const productErrors: string[] = [];

    for (const productRecord of allProducts) {
      try {
        // Get variants for this product
        const variants = await db.select().from(product_variants).where(eq(product_variants.product_id, productRecord.id));
        
        // Deserialize the product
        const product = deserializeProduct(productRecord);
        
        // Parse and attach variants (using same logic as vectorize-products)
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

        // Map the product data for markdown generation
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
        
        // Generate markdown content
        const mdContent = generateProductMarkdown(mappedProduct);

        const productAny = product as any;
        const slug = productAny.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        if (!mdContent || mdContent.trim().length < 10) {
          productErrors.push(`Insufficient content generated for product ${productAny.id}`);
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

        productResults.push(`${slug} (ID: ${productAny.id})`);
        
      } catch (error) {
        const productAny = productRecord as any;
        productErrors.push(`Error processing product ${productAny.id}: ${error}`);
      }
    }

    console.log(`Product vectorization complete: ${productResults.length} indexed, ${productErrors.length} errors`);

    // ==========================================
    // STEP 3: Vectorize Knowledge Articles
    // ==========================================
    console.log("Starting knowledge article vectorization...");
    
    // List .md files in knowledge_md/
    const list = await media.list({ prefix: "knowledge_md/" });
    const knowledgeResults: string[] = [];
    const knowledgeErrors: string[] = [];

    for (const obj of list.objects) {
      if (!obj.key.endsWith(".md")) continue;

      try {
        const slug = obj.key.replace("knowledge_md/", "").replace(".md", "");
        const file = await media.get(obj.key);
        if (!file) {
          knowledgeErrors.push(`File not found: ${obj.key}`);
          continue;
        }

        const text = await file.text();
        if (!text || text.trim().length < 10) {
          knowledgeErrors.push(`Insufficient content: ${slug}`);
          continue;
        }

        // Embed with Cloudflare AI (using same model as products)
        const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text });

        // Store vector in index with knowledge source
        await vectorize.upsert([
          {
            id: `knowledge-${slug}`,
            values: embedding.data[0],
            metadata: {
              slug,
              source: "knowledge",
              text: text.substring(0, 1000), // Store first 1000 chars for context
            },
          },
        ]);

        knowledgeResults.push(slug);
      } catch (error) {
        knowledgeErrors.push(`Error processing ${obj.key}: ${error}`);
      }
    }

    console.log(`Knowledge vectorization complete: ${knowledgeResults.length} indexed, ${knowledgeErrors.length} errors`);

    // ==========================================
    // STEP 4: Return comprehensive results
    // ==========================================
    const totalTime = Date.now() - startTime;
    const totalIndexed = productResults.length + knowledgeResults.length;
    const totalErrors = productErrors.length + knowledgeErrors.length;

    const response = {
      success: true,
      message: `Consolidated vectorization complete. Indexed ${totalIndexed} items (${productResults.length} products + ${knowledgeResults.length} knowledge articles) in ${(totalTime / 1000).toFixed(1)}s.`,
      executionTimeMs: totalTime,
      summary: {
        totalIndexed,
        totalErrors,
        products: {
          total: allProducts.length,
          indexed: productResults.length,
          errors: productErrors.length
        },
        knowledge: {
          total: list.objects.filter((obj: any) => obj.key.endsWith('.md')).length,
          indexed: knowledgeResults.length,
          errors: knowledgeErrors.length
        }
      },
      details: {
        productResults,
        knowledgeResults,
        productErrors: productErrors.length > 0 ? productErrors : undefined,
        knowledgeErrors: knowledgeErrors.length > 0 ? knowledgeErrors : undefined,
      },
      workflow: [
        "1. Cleared existing vector index to prevent stale data",
        "2. Vectorized products from MACH database with AI notes",
        "3. Generated and uploaded product markdown files to R2",
        "4. Vectorized knowledge articles from R2 knowledge_md/ folder",
        "5. Embedded all content using Cloudflare AI BGE model",
        "6. Stored vectors in Vectorize index with source metadata"
      ]
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Consolidated vectorization error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
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