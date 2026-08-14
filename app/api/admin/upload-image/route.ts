import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { uploadToR2, generateR2Path, R2_FOLDERS } from "@/lib/utils/r2";
import { EXT_BY_MIME, matchesImageSignature } from "@/lib/utils/image-signature";
import { normalizeSafeFilenameSegment } from "@/lib/utils/safe-filename";
import { getStoreConfig } from "@/lib/store-config";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/admin/upload-image
 * 
 * Uploads images to Cloudflare R2 for supported merchant-owned content.
 * Handles file validation, path generation, and R2 storage.
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const permissionCheck = await checkAdminPermissions(request);
    if (!permissionCheck.success) {
      return NextResponse.json(
        { error: permissionCheck.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");
    const filename = normalizeSafeFilenameSegment(formData.get("filename"));

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const validFolders = [R2_FOLDERS.PRODUCTS, R2_FOLDERS.CATEGORIES, R2_FOLDERS.BLOG];
    if (typeof folder !== 'string' || !validFolders.includes(folder as any)) {
      return NextResponse.json(
        { error: `Invalid folder. Must be one of: ${validFolders.join(', ')}` },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Both File.type and File.name are client-controlled. The allowlist maps a
    // declared type to the only extension the server may persist.
    const fileExtension = EXT_BY_MIME[file.type];
    if (!fileExtension) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Invalid file size. Image must be between 1 byte and 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!matchesImageSignature(new Uint8Array(arrayBuffer), file.type)) {
      return NextResponse.json(
        { error: "File content does not match the declared image type." },
        { status: 400 }
      );
    }

    // The caller supplies only a safe human-readable stem. Uniqueness and the
    // extension are server controlled so uploads cannot collide or smuggle a
    // dangerous suffix through File.name.
    const storedFilename = `${filename}-${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;
    const r2Path = generateR2Path(folder, storedFilename);
    const storedContentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

    // Use the generated CloudflareEnv binding type rather than treating
    // process.env strings as runtime service bindings.
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.MEDIA;
    
    if (!bucket) {
      return NextResponse.json(
        { error: "R2 bucket not configured" },
        { status: 500 }
      );
    }

    // Persist only the verified, normalized MIME type.
    await uploadToR2(bucket, r2Path, arrayBuffer, {
      contentType: storedContentType,
      customMetadata: {
        originalName: file.name,
        folder: folder,
        uploadType: 'admin-image'
      }
    });

    // Generate the path format for database storage
    const storedPath = `/${r2Path}`;
    const imageCdn = getStoreConfig().urls.imageCdn;
    const publicUrl = imageCdn ? new URL(r2Path, `${imageCdn}/`).href : undefined;

    return NextResponse.json({
      success: true,
      path: storedPath, // This gets saved in database and used with image-loader.ts
      ...(publicUrl && { url: publicUrl }),
      filename: storedFilename,
      size: file.size,
      type: storedContentType
    });

  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
