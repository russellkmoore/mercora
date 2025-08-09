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
// import { products, productAiNotes } from "@/lib/db/schema/clean-mach-schema";
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

    // Token check
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    
    if (token !== ADMIN_VECTORIZE_TOKEN) {
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

    // Query all products from the MACH database
    const db = await getDbAsync();
    const allProducts = await db.select().from(products);
    
    console.log(`Found ${allProducts.length} products to process`);
    
    const results = [];
    const errors = [];

    for (const product of allProducts) {
      try {
        // Parse JSON fields from MACH schema
        const name = typeof product.name === 'string' ? JSON.parse(product.name) : product.name;
        const description = typeof product.description === 'string' ? JSON.parse(product.description) : product.description;
        const pricing = typeof product.pricing === 'string' ? JSON.parse(product.pricing) : product.pricing;
        const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
        const categories = typeof product.categories === 'string' ? JSON.parse(product.categories) : product.categories;
        const attributes = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : product.attributes;
        
        // Get AI notes from extension table
        let aiNotes = '';
        try {
          const aiNotesResult = await db.select()
            .from(productAiNotes)
            .where(eq(productAiNotes.productId, product.id))
            .limit(1);
          
          if (aiNotesResult.length > 0) {
            aiNotes = aiNotesResult[0].aiNotes || '';
          }
        } catch (aiNotesError) {
          console.log(`No AI notes found for product ${product.id}:`, aiNotesError);
        }

        // Generate slug for filename
        const slug = product.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Create comprehensive markdown content
        const mdContent = generateProductMarkdown({
          id: product.id,
          sku: product.sku,
          name: name?.en || 'Unknown Product',
          description: description?.en || '',
          pricing: pricing || {},
          images: images || [],
          categories: categories || [],
          attributes: attributes || {},
          aiNotes: aiNotes,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
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
  aiNotes: string;
  createdAt: string;
  updatedAt: string;
}): string {
  const { id, sku, name, description, pricing, images, categories, attributes, aiNotes, createdAt, updatedAt } = product;
  
  let md = `---
id: ${id}
sku: ${sku}
name: ${name}
created: ${createdAt}
updated: ${updatedAt}
---

# ${name}

## Product Information
- **SKU**: ${sku}
- **Product ID**: ${id}
`;

  // Add pricing information
  if (pricing.basePrice) {
    md += `- **Price**: $${pricing.basePrice.toFixed(2)}`;
    if (pricing.compareAtPrice && pricing.compareAtPrice > pricing.basePrice) {
      md += ` (Compare at $${pricing.compareAtPrice.toFixed(2)})`;
    }
    md += `\n`;
  }

  // Add categories
  if (categories && categories.length > 0) {
    md += `- **Categories**: ${categories.map((cat: any) => cat.name?.en || cat.name).join(', ')}\n`;
  }

  // Add description
  if (description) {
    md += `\n## Description\n${description}\n`;
  }

  // Add attributes/specifications
  if (attributes && Object.keys(attributes).length > 0) {
    md += `\n## Specifications\n`;
    for (const [key, value] of Object.entries(attributes)) {
      md += `- **${key}**: ${value}\n`;
    }
  }

  // Add images
  if (images && images.length > 0) {
    md += `\n## Images\n`;
    images.forEach((img: any, index: number) => {
      md += `${index + 1}. ${img.url}${img.alt ? ` (${img.alt})` : ''}\n`;
    });
  }

  // Add AI notes if present
  if (aiNotes && aiNotes.trim().length > 0) {
    md += `\n## AI Assistant Notes\n${aiNotes}\n`;
  }

  return md;
}
