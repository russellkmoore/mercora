/**
 * === Vectorize Products API ===
 *
 * This endpoint loads all Markdown files from the `products_md/` folder in the
 * bound R2 bucket (`MEDIA`), embeds them using Cloudflare AI's BAAI model,
 * and stores the resulting vectors in the bound `VECTORIZE` index.
 *
 * Each file is expected to be a product entry with structured Markdown,
 * including optional frontmatter and `ai_notes`.
 *
 * === Security ===
 * This route is protected with an access token passed via query string.
 * The expected token value must match the secret stored as `ADMIN_VECTORIZE_TOKEN`.
 *
 * === Setup ===
 * 1. Bind R2, Vectorize, and AI in `wrangler.jsonc`:
 *
 *    ```jsonc
 *    "r2_buckets": [
 *      {
 *        "binding": "MEDIA",
 *        "bucket_name": "voltique-images"
 *      }
 *    ],
 *    "vectorize": [
 *      {
 *        "binding": "VECTORIZE",
 *        "index_name": "voltique-index"
 *      }
 *    ],
 *    "ai": {
 *      "binding": "AI"
 *    }
 *    ```
 *
 * 2. Upload Markdown files to R2 under `products_md/` prefix.
 *
 * 3. Set the admin secret token:
 *
 *    ```bash
 *    npx wrangler secret put ADMIN_VECTORIZE_TOKEN
 *    ```
 *
 * 4. Deploy the route and trigger it with:
 *
 *    ```
 *    GET /api/vectorize-products?token=your-token-here
 *    ```
 *
 * === Example Usage ===
 *
 *    curl "https://yourdomain.com/api/vectorize-products?token=mercora-vector-admin"
 *
 * === Returns ===
 * A plain-text summary of how many files were vectorized, including slugs.
 *
 * === Notes ===
 * - Only `.md` files in `products_md/` are processed.
 * - Files with insufficient content are skipped.
 * - Vector entries are stored using the product slug as the document ID.
 * - ProductId is extracted from filename for metadata compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

    // List .md files in products_md/
    const list = await media.list({ prefix: "products_md/" });
    const results = [];
    const errors = [];

    for (const obj of list.objects) {
      if (!obj.key.endsWith(".md")) continue;

      try {
        const slug = obj.key.replace("products_md/", "").replace(".md", "");
        const file = await media.get(obj.key);
        if (!file) {
          errors.push(`File not found: ${obj.key}`);
          continue;
        }

        const text = await file.text();
        if (!text || text.trim().length < 10) {
          errors.push(`Insufficient content: ${slug}`);
          continue;
        }

        // Extract product ID from the content or filename
        // Look for ID in frontmatter or use a numeric extraction from slug
        let productId: number | undefined;
        const frontmatterMatch = text.match(/^---[\s\S]*?id:\s*(\d+)/);
        if (frontmatterMatch) {
          productId = parseInt(frontmatterMatch[1], 10);
        } else {
          // Try to extract numeric ID from slug if no frontmatter
          const numericMatch = slug.match(/(\d+)/);
          if (numericMatch) {
            productId = parseInt(numericMatch[1], 10);
          }
        }

        // Embed with Cloudflare AI (using 768-dimension model to match existing index)
        const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text });

        // Store vector in index with productId for agent-chat compatibility
        await vectorize.upsert([
          {
            id: slug,
            values: embedding.data[0], // Extract the actual vector array
            metadata: {
              slug,
              source: "product",
              text: text.substring(0, 1000), // Store first 1000 chars for context
              productId: productId?.toString() || "",
            },
          },
        ]);

        results.push(slug + (productId ? ` (ID: ${productId})` : ""));
      } catch (error) {
        errors.push(`Error processing ${obj.key}: ${error}`);
      }
    }

    const response = {
      success: true,
      message: `Vectorization complete. Indexed ${results.length} files.`,
      indexed: results,
      errors: errors.length > 0 ? errors : undefined,
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
