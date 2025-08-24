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
 *
 * === Security ===
 * Protected with an access token passed via query string.
 * The expected token value must match the secret stored as `ADMIN_VECTORIZE_TOKEN`.
 *
 * === Returns ===
 * A JSON response showing how many products were processed and vectorized.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
// TODO: Create products schema - temporarily commented out  
import { products, product_variants } from "@/lib/db/schema/";

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
          },
          note: "Bindings should be available in globalThis when deployed to Cloudflare Workers"
        },
        { status: 500 }
      );
    }

    // Query all products and all variants from the MACH database
    const db = await getDbAsync();
  const allProducts = await db.select().from(products);
  const allVariants = await db.select().from(product_variants);

    console.log(`Found ${allProducts.length} products to process`);

    const results = [];
    const errors = [];

    for (const product of allProducts) {
      try {
        console.log('Processing product:', product.id, 'name:', product.name);
        // Helper function to safely parse JSON fields
        const safeJsonParse = (field: any, expectedStart: string = '{') => {
          if (typeof field === 'string' && field.startsWith(expectedStart)) {
            try {
              return JSON.parse(field);
            } catch (e) {
              return field;
            }
          }
          return field;
        };

        // Parse JSON fields from MACH schema - handle both JSON strings and plain strings  
        const name = safeJsonParse(product.name);
        const description = safeJsonParse(product.description);
        const categories = safeJsonParse(product.categories, '[');
        // Find the default variant for this product
        const defaultVariantId = product.default_variant_id;
        const defaultVariant = allVariants.find((v: any) => v.product_id === product.id && v.id === defaultVariantId);
        let pricing = {};
        let images = [];
        let attributes = {};
        if (defaultVariant) {
          const parsedPrice = safeJsonParse(defaultVariant.price);
          const parsedComparePrice = safeJsonParse(defaultVariant.compare_at_price);
          
          pricing = {
            basePrice: parsedPrice ? (typeof parsedPrice === 'object' ? parsedPrice.amount : parsedPrice) : undefined,
            compareAtPrice: parsedComparePrice ? (typeof parsedComparePrice === 'object' ? parsedComparePrice.amount : parsedComparePrice) : undefined,
            currency: parsedPrice ? (typeof parsedPrice === 'object' ? parsedPrice.currency : 'USD') : undefined
          };
          images = safeJsonParse(defaultVariant.media, '[') || [];
          attributes = safeJsonParse(defaultVariant.attributes) || {};
        }
        // Generate slug for filename
        const slug = product.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        // Parse extensions and other meta fields using the safe parser
        const extensions = safeJsonParse(product.extensions) || {};
        const tags = safeJsonParse(product.tags, '[') || [];
        const useCases = extensions.use_cases || [];
        const aiNotesFinal = extensions.ai_notes || '';
        const brand = product.brand || '';
        const rating = safeJsonParse(product.rating) || {};
        const relatedProducts = safeJsonParse(product.related_products, '[') || [];

        const mdContent = generateProductMarkdown({
          id: product.id,
          sku: product.id,
          name: (typeof name === 'string' ? name : name?.en) || 'Unknown Product',
          description: (typeof description === 'string' ? description : description?.en) || '',
          pricing: pricing || {},
          images: images || [],
          categories: categories || [],
          attributes: attributes || {},
          tags: tags,
          useCases: useCases,
          aiNotes: aiNotesFinal,
          brand: brand,
          rating: rating,
          relatedProducts: relatedProducts,
          extensions: extensions,
          createdAt: product.created_at || '',
          updatedAt: product.updated_at || ''
        });

        if (!mdContent || mdContent.trim().length < 10) {
          errors.push(`Insufficient content generated for product ${product.id}`);
          continue;
        }

        // Upload to R2
        const fileName = `products_md/${slug}.md`;
        await media.put(fileName, mdContent, {
          httpMetadata: {
            contentType: 'text/markdown'
          }
        });

        // Embed with Cloudflare AI (using 768-dimension model to match existing index)
        const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text: mdContent });

        // Store vector in index with productId for agent-chat compatibility
        await vectorize.upsert([
          {
            id: slug,
            values: embedding.data[0], // Extract the actual vector array
            metadata: {
              slug,
              source: "product",
              text: mdContent.substring(0, 1000), // Store first 1000 chars for context
              productId: product.id,
            },
          },
        ]);

        results.push(`${slug} (ID: ${product.id})`);
        
      } catch (error) {
        errors.push(`Error processing product ${product.id}: ${error}`);
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

// Also support POST for easier calling
export async function POST(request: NextRequest) {
  return GET(request);
}

// Test endpoint to verify deployment
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({ 
    message: "Vectorize API v2.1 - Fixed JSON parsing", 
    timestamp: new Date().toISOString() 
  });
}

/**
 * Generate comprehensive markdown content for a product
 */
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
