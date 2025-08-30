import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { uploadToR2, generateR2Path, getContentTypeFromFilename, R2_FOLDERS } from "@/lib/utils/r2";

/**
 * POST /api/admin/upload-image
 * 
 * Uploads images to Cloudflare R2 bucket for products/categories.
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
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string; // "products" or "categories"
    const filename = formData.get("filename") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const validFolders = [R2_FOLDERS.PRODUCTS, R2_FOLDERS.CATEGORIES];
    if (!folder || !validFolders.includes(folder as any)) {
      return NextResponse.json(
        { error: `Invalid folder. Must be one of: ${validFolders.join(', ')}` },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: "No filename provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Generate R2 path
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fullFilename = `${filename}.${fileExtension}`;
    const r2Path = generateR2Path(folder, fullFilename);

    // Get R2 bucket from environment
    const env = process.env as any;
    const bucket = env.MEDIA as R2Bucket;
    
    if (!bucket) {
      return NextResponse.json(
        { error: "R2 bucket not configured" },
        { status: 500 }
      );
    }

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();

    // Upload to R2 using consolidated utility
    await uploadToR2(bucket, r2Path, arrayBuffer, {
      contentType: file.type || getContentTypeFromFilename(fullFilename),
      customMetadata: {
        originalName: file.name,
        folder: folder,
        uploadType: 'admin-image'
      }
    });

    // Generate the path format for database storage
    const storedPath = `/${r2Path}`;

    return NextResponse.json({
      success: true,
      path: storedPath, // This gets saved in database and used with image-loader.ts
      filename: `${filename}.${fileExtension}`,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}