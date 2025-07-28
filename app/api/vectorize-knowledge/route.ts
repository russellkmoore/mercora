/**
 * === Vectorize Knowledge Articles API ===
 *
 * This route loads all Markdown files from the `knowledge_md/` folder
 * in the bound R2 bucket (`MEDIA`), embeds them using Cloudflare AI's BAAI model,
 * and stores the resulting vectors in the `VECTORIZE` index.
 *
 * Each file is expected to be a structured Markdown file with user-facing content and AI notes.
 *
 * === Security ===
 * Access is protected with a token passed via query string. Token must match the value
 * stored as a secret: `ADMIN_VECTORIZE_TOKEN`.
 *
 * === Setup ===
 *
 * 1. Ensure the following bindings exist in `wrangler.jsonc`:
 *
 *    ```jsonc
 *    "r2_buckets": [
 *      { "binding": "MEDIA", "bucket_name": "voltique-images" }
 *    ],
 *    "vectorize": [
 *      { "binding": "VECTORIZE", "index_name": "voltique-index" }
 *    ],
 *    "ai": {
 *      "binding": "AI"
 *    }
 *    ```
 *
 * 2. Upload `.md` files to your R2 bucket under `knowledge_md/`
 *
 * 3. Set your access token:
 *
 *    ```bash
 *    npx wrangler secret put ADMIN_VECTORIZE_TOKEN
 *    ```
 *
 * 4. Deploy and trigger the route:
 *
 *    ```
 *    GET /api/vectorize-knowledge?token=your-secret-token
 *    ```
 *
 * === Returns ===
 * A JSON summary of all embedded article IDs (slugs) and any errors.
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

    // List .md files in knowledge_md/
    const list = await media.list({ prefix: "knowledge_md/" });
    const results = [];
    const errors = [];

    for (const obj of list.objects) {
      if (!obj.key.endsWith(".md")) continue;

      try {
        const slug = obj.key.replace("knowledge_md/", "").replace(".md", "");
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

        // Embed with Cloudflare AI (using 768-dimension model to match existing index)
        const embedding = await ai.run("@cf/baai/bge-base-en-v1.5", { text });

        // Store vector in index with knowledge/FAQ source
        await vectorize.upsert([
          {
            id: `knowledge-${slug}`,
            values: embedding.data[0], // Extract the actual vector array
            metadata: {
              slug,
              source: "knowledge",
              text: text.substring(0, 1000), // Store first 1000 chars for context
            },
          },
        ]);

        results.push(slug);
      } catch (error) {
        errors.push(`Error processing ${obj.key}: ${error}`);
      }
    }

    const response = {
      success: true,
      message: `Knowledge vectorization complete. Indexed ${results.length} files.`,
      indexed: results,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Knowledge vectorization error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
