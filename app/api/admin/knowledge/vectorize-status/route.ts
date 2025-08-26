import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";

// Update vectorization status for knowledge articles
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get Cloudflare bindings
    const { env } = await getCloudflareContext({ async: true });
    const MEDIA = (env as any).MEDIA;
    
    if (!MEDIA) {
      return NextResponse.json({ error: "R2 bucket not configured" }, { status: 500 });
    }

    const body: any = await request.json();
    const { filename, vectorized } = body;

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    const key = `knowledge_md/${filename}`;

    // Get the existing object to preserve content
    const existingObj = await MEDIA.get(key);
    if (!existingObj) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = await existingObj.text();
    const existingMetadata = existingObj.customMetadata || {};

    // Update the object with new vectorization status
    await MEDIA.put(key, content, {
      httpMetadata: {
        contentType: 'text/markdown'
      },
      customMetadata: {
        ...existingMetadata,
        vectorized: vectorized ? 'true' : 'false',
        vectorizedAt: vectorized ? new Date().toISOString() : undefined
      }
    });

    return NextResponse.json({ 
      success: true, 
      filename,
      vectorized,
      message: `Vectorization status updated for ${filename}` 
    });

  } catch (error) {
    console.error("Error updating vectorization status:", error);
    return NextResponse.json(
      { 
        error: "Failed to update vectorization status",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}