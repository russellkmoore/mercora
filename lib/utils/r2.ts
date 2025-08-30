/**
 * R2 Bucket Utilities
 * Comprehensive utilities for Cloudflare R2 bucket operations
 * Used by: image uploads, vectorize API, knowledge management
 */

/**
 * R2 file upload options
 */
export interface R2UploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

/**
 * Upload file to R2 bucket
 * @param bucket - R2 bucket instance
 * @param path - File path in bucket (e.g., "products/image.jpg")
 * @param content - File content (File, ArrayBuffer, string, etc.)
 * @param options - Upload options
 */
export async function uploadToR2(
  bucket: R2Bucket, 
  path: string, 
  content: File | ArrayBuffer | string | Uint8Array,
  options: R2UploadOptions = {}
) {
  const uploadOptions: any = {};
  
  if (options.httpMetadata || options.contentType) {
    uploadOptions.httpMetadata = {
      contentType: options.contentType || options.httpMetadata?.contentType,
      ...options.httpMetadata
    };
  }
  
  if (options.customMetadata) {
    uploadOptions.customMetadata = {
      uploadedAt: new Date().toISOString(),
      ...options.customMetadata
    };
  }
  
  return await bucket.put(path, content, uploadOptions);
}

/**
 * Get file from R2 bucket
 * @param bucket - R2 bucket instance  
 * @param path - File path in bucket
 * @returns R2 object or null if not found
 */
export async function getFromR2(bucket: R2Bucket, path: string) {
  return await bucket.get(path);
}

/**
 * List files in R2 bucket
 * @param bucket - R2 bucket instance
 * @param prefix - Optional path prefix to filter by
 * @param limit - Maximum number of files to return
 */
export async function listR2Files(bucket: R2Bucket, prefix?: string, limit?: number) {
  return await bucket.list({ prefix, limit });
}

/**
 * Delete file from R2 bucket
 * @param bucket - R2 bucket instance
 * @param path - File path to delete
 */
export async function deleteFromR2(bucket: R2Bucket, path: string) {
  return await bucket.delete(path);
}

/**
 * R2 bucket folders used in the application
 */
export const R2_FOLDERS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories', 
  PRODUCTS_MD: 'products_md',
  KNOWLEDGE_MD: 'knowledge_md'
} as const;

/**
 * Check if a URL/path is an R2 bucket path
 * @param pathOrUrl - Path or URL to check
 * @returns True if it's an R2 bucket path
 */
export function isR2Path(pathOrUrl: string): boolean {
  if (!pathOrUrl) return false;
  
  // Check if it's a bucket path (starts with / and contains known folder)
  const folders = Object.values(R2_FOLDERS);
  if (pathOrUrl.startsWith("/")) {
    return folders.some(folder => pathOrUrl.includes(`/${folder}/`));
  }
  
  // Check without leading slash
  return folders.some(folder => pathOrUrl.startsWith(`${folder}/`));
}

/**
 * Normalize path for R2 storage (ensure leading slash)
 * @param path - Path to normalize
 * @returns Normalized path for database storage
 */
export function normalizeR2Path(path: string): string {
  if (!path) return "";
  
  // If it's already a path, ensure leading slash
  if (!path.startsWith("http://") && !path.startsWith("https://")) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  
  // For URLs, return as-is (external URLs)
  return path;
}

/**
 * Generate clean filename from text (used for products, knowledge articles, etc.)
 * @param text - Source text (product name, article title, etc.)
 * @param suffix - Optional suffix (e.g., "primary", "thumbnail", "v2")
 * @returns Clean filename suitable for R2 storage
 */
export function generateR2Filename(text: string, suffix?: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
  
  return suffix ? `${slug}-${suffix}` : slug;
}

/**
 * Generate full R2 path for file
 * @param folder - R2 folder (from R2_FOLDERS)
 * @param filename - Filename with extension
 * @returns Full R2 path (without leading slash)
 */
export function generateR2Path(folder: string, filename: string): string {
  return `${folder}/${filename}`;
}

/**
 * Detect content type from file extension
 * @param filename - Filename with extension
 * @returns MIME type
 */
export function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'md':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Get display path for images (works with Next.js Image component and image-loader.ts)
 * @param pathOrUrl - R2 path or external URL
 * @returns Path for use with Next.js Image component src prop
 */
export function getImageDisplayPath(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  
  // If it's an R2 path, return the path without leading slash for image-loader.ts
  if (isR2Path(pathOrUrl)) {
    return pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;
  }
  
  // For external URLs, return as-is
  return pathOrUrl;
}

/**
 * Convenience function for uploading markdown content to R2
 * Used by vectorize API and knowledge management
 * @param bucket - R2 bucket instance
 * @param folder - Folder (e.g., R2_FOLDERS.PRODUCTS_MD)
 * @param filename - Filename without extension
 * @param markdownContent - Markdown content
 */
export async function uploadMarkdownToR2(
  bucket: R2Bucket,
  folder: string, 
  filename: string,
  markdownContent: string
) {
  const path = generateR2Path(folder, `${filename}.md`);
  return await uploadToR2(bucket, path, markdownContent, {
    contentType: 'text/markdown',
    customMetadata: {
      contentType: 'markdown',
      uploadType: 'vectorize'
    }
  });
}

/**
 * Convenience function for uploading images to R2
 * @param bucket - R2 bucket instance
 * @param folder - Folder (e.g., R2_FOLDERS.PRODUCTS)
 * @param filename - Filename with extension
 * @param imageData - Image file data
 * @param originalName - Original filename for metadata
 */
export async function uploadImageToR2(
  bucket: R2Bucket,
  folder: string,
  filename: string, 
  imageData: File | ArrayBuffer,
  originalName?: string
) {
  const path = generateR2Path(folder, filename);
  const contentType = getContentTypeFromFilename(filename);
  
  return await uploadToR2(bucket, path, imageData, {
    contentType,
    customMetadata: {
      originalName: originalName || filename,
      contentType: 'image',
      uploadType: 'admin'
    }
  });
}