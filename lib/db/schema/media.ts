/**
 * MACH Alliance Open Data Model - Media Schema
 * 
 * Drizzle ORM schema for the Media utility object following the MACH Alliance standards.
 * Optimized for Cloudflare D1 database with JSON storage for complex objects.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/media.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { 
  Media,
  File,
  MediaVariant,
  FocalPoint,
  Accessibility
} from "@/lib/types";

/**
 * Media table schema
 * 
 * Standardized utility object for representing media assets across all entities
 * in the MACH Alliance Common Data Model. Supports images, videos, documents,
 * audio, and 3D models with comprehensive metadata and variants.
 */
export const media = sqliteTable("media", {
  // Core identification - OPTIONAL (but using id as primary key)
  id: text("id").primaryKey(), // Unique identifier for the media asset
  type: text("type", { 
    enum: ["image", "video", "document", "audio", "3d"] 
  }).default("image"), // Type of media asset
  status: text("status", { 
    enum: ["draft", "published", "active", "archived", "deleted"] 
  }).default("active"), // Lifecycle status
  
  // External references - OPTIONAL
  externalReferences: text("external_references", { mode: "json" }).$type<Record<string, string>>(),
  
  // Timestamps - OPTIONAL
  createdAt: text("created_at"), // ISO 8601 creation timestamp
  updatedAt: text("updated_at"), // ISO 8601 update timestamp
  
  // Display information - OPTIONAL (localizable)
  title: text("title", { mode: "json" }).$type<string | Record<string, string>>(),
  description: text("description", { mode: "json" }).$type<string | Record<string, string>>(),
  
  // Categorization - OPTIONAL
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  
  // Core file information - REQUIRED
  file: text("file", { mode: "json" }).$type<File>().notNull(),
  
  // Media variants and derivatives - OPTIONAL
  variants: text("variants", { mode: "json" }).$type<MediaVariant[]>(),
  thumbnail: text("thumbnail", { mode: "json" }).$type<File>(),
  focalPoint: text("focal_point", { mode: "json" }).$type<FocalPoint>(),
  
  // Accessibility - OPTIONAL
  accessibility: text("accessibility", { mode: "json" }).$type<Accessibility>(),
  
  // Technical metadata - OPTIONAL
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  
  // Extensions for custom data - OPTIONAL
  extensions: text("extensions", { mode: "json" }).$type<Record<string, any>>(),
});

/**
 * Helper: convert DB record to MACH Media
 */
export function deserializeMedia(record: typeof media.$inferSelect): Media {
  return {
    id: record.id,
    type: record.type as Media['type'],
    status: record.status as Media['status'],
    external_references: record.externalReferences || undefined,
    created_at: record.createdAt || undefined,
    updated_at: record.updatedAt || undefined,
    title: record.title || undefined,
    description: record.description || undefined,
    tags: record.tags || undefined,
    file: record.file,
    variants: record.variants || undefined,
    thumbnail: record.thumbnail || undefined,
    focal_point: record.focalPoint || undefined,
    accessibility: record.accessibility || undefined,
    metadata: record.metadata || undefined,
    extensions: record.extensions || undefined,
  };
}

/**
 * Helper: convert MACH Media to DB insert format
 */
export function serializeMedia(machMedia: Media): typeof media.$inferInsert {
  return {
    id: machMedia.id || generateMediaId(),
    type: machMedia.type || "image",
    status: machMedia.status || "active",
    externalReferences: machMedia.external_references,
    createdAt: machMedia.created_at,
    updatedAt: machMedia.updated_at,
    title: machMedia.title,
    description: machMedia.description,
    tags: machMedia.tags,
    file: machMedia.file,
    variants: machMedia.variants,
    thumbnail: machMedia.thumbnail,
    focalPoint: machMedia.focal_point,
    accessibility: machMedia.accessibility,
    metadata: machMedia.metadata,
    extensions: machMedia.extensions,
  };
}

/**
 * Generate unique media ID with timestamp and random suffix
 */
export function generateMediaId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `MEDIA-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validate media file object
 */
export function validateMediaFile(file: File): boolean {
  if (!file.url || typeof file.url !== 'string') {
    return false;
  }
  
  if (!file.format || typeof file.format !== 'string') {
    return false;
  }
  
  // Validate URL format
  try {
    new URL(file.url);
  } catch {
    return false;
  }
  
  return true;
}

/**
 * Validate media variant
 */
export function validateMediaVariant(variant: MediaVariant): boolean {
  if (!variant.variant_type || typeof variant.variant_type !== 'string') {
    return false;
  }
  
  if (!variant.url || typeof variant.url !== 'string') {
    return false;
  }
  
  if (!variant.format || typeof variant.format !== 'string') {
    return false;
  }
  
  // Validate URL format
  try {
    new URL(variant.url);
  } catch {
    return false;
  }
  
  return true;
}

/**
 * Validate focal point coordinates
 */
export function validateFocalPoint(focalPoint: FocalPoint): boolean {
  if (typeof focalPoint.x !== 'number' || focalPoint.x < 0 || focalPoint.x > 1) {
    return false;
  }
  
  if (typeof focalPoint.y !== 'number' || focalPoint.y < 0 || focalPoint.y > 1) {
    return false;
  }
  
  return true;
}

/**
 * Extract file extension from URL or filename
 */
export function extractFileExtension(urlOrFilename: string): string {
  const url = new URL(urlOrFilename, 'http://example.com');
  const pathname = url.pathname;
  const parts = pathname.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Determine media type from file format
 */
export function getMediaTypeFromFormat(format: string): Media['type'] {
  const lowerFormat = format.toLowerCase();
  
  // Image formats
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff'].includes(lowerFormat)) {
    return 'image';
  }
  
  // Video formats
  if (['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v'].includes(lowerFormat)) {
    return 'video';
  }
  
  // Document formats
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(lowerFormat)) {
    return 'document';
  }
  
  // Audio formats
  if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'].includes(lowerFormat)) {
    return 'audio';
  }
  
  // 3D formats
  if (['glb', 'gltf', 'usdz', 'obj', 'fbx', 'dae', 'ply', 'stl'].includes(lowerFormat)) {
    return '3d';
  }
  
  // Default to image
  return 'image';
}

/**
 * Check if media type supports dimensions
 */
export function supportsImageDimensions(type?: Media['type']): boolean {
  return type ? ['image', 'video'].includes(type) : false;
}

/**
 * Check if media type supports duration
 */
export function supportsDuration(type?: Media['type']): boolean {
  return type ? ['video', 'audio'].includes(type) : false;
}

/**
 * Generate responsive image variants
 */
export function generateResponsiveVariants(
  baseUrl: string,
  format: string,
  sizes: { label: string; width: number; height: number }[]
): MediaVariant[] {
  return sizes.map(size => ({
    variant_type: 'responsive',
    label: size.label,
    url: baseUrl.replace(/\.([^.]+)$/, `-${size.label}.$1`),
    format,
    width: size.width,
    height: size.height,
  }));
}

/**
 * Generate format variants
 */
export function generateFormatVariants(
  baseUrl: string,
  originalFormat: string,
  targetFormats: string[]
): MediaVariant[] {
  return targetFormats
    .filter(format => format !== originalFormat)
    .map(format => ({
      variant_type: 'format',
      label: format,
      url: baseUrl.replace(/\.([^.]+)$/, `.${format}`),
      format,
    }));
}

/**
 * Calculate aspect ratio from dimensions
 */
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * Estimate file size based on dimensions and format
 */
export function estimateFileSize(
  width: number, 
  height: number, 
  format: string, 
  quality: number = 85
): number {
  const pixels = width * height;
  let bytesPerPixel: number;
  
  switch (format.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      bytesPerPixel = (quality / 100) * 3; // RGB channels
      break;
    case 'png':
      bytesPerPixel = 4; // RGBA channels
      break;
    case 'webp':
      bytesPerPixel = (quality / 100) * 2.5; // Compressed format
      break;
    case 'avif':
      bytesPerPixel = (quality / 100) * 1.5; // Highly compressed
      break;
    default:
      bytesPerPixel = 3;
  }
  
  return Math.round(pixels * bytesPerPixel);
}

/**
 * Generate thumbnail URL from main file URL
 */
export function generateThumbnailUrl(
  mainUrl: string, 
  thumbnailSuffix: string = '-thumb'
): string {
  return mainUrl.replace(/\.([^.]+)$/, `${thumbnailSuffix}.$1`);
}

/**
 * Validate accessibility features
 */
export function validateAccessibility(accessibility: Accessibility): string[] {
  const errors: string[] = [];
  
  if (accessibility.alt_text && accessibility.alt_text.trim().length === 0) {
    errors.push('Alt text cannot be empty');
  }
  
  if (accessibility.decorative === true && accessibility.alt_text) {
    errors.push('Decorative images should not have alt text');
  }
  
  if (accessibility.decorative === false && !accessibility.alt_text) {
    errors.push('Non-decorative images must have alt text');
  }
  
  if (accessibility.captions_url) {
    try {
      new URL(accessibility.captions_url);
    } catch {
      errors.push('Invalid captions URL format');
    }
  }
  
  return errors;
}

/**
 * Get supported formats for a media type
 */
export function getSupportedFormats(type: Media['type']): string[] {
  switch (type) {
    case 'image':
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff'];
    case 'video':
      return ['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v'];
    case 'document':
      return ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];
    case 'audio':
      return ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'];
    case '3d':
      return ['glb', 'gltf', 'usdz', 'obj', 'fbx', 'dae', 'ply', 'stl'];
    default:
      return [];
  }
}

/**
 * Check if format is supported for media type
 */
export function isFormatSupported(format: string, type: Media['type']): boolean {
  return getSupportedFormats(type).includes(format.toLowerCase());
}

/**
 * Get recommended formats for web delivery
 */
export function getWebOptimizedFormats(type: Media['type']): string[] {
  switch (type) {
    case 'image':
      return ['webp', 'avif', 'jpg']; // Modern formats first
    case 'video':
      return ['mp4', 'webm']; // Wide compatibility
    case 'document':
      return ['pdf']; // Universal document format
    case 'audio':
      return ['mp3', 'aac', 'ogg']; // Wide compatibility
    case '3d':
      return ['glb', 'usdz']; // AR/VR compatible
    default:
      return [];
  }
}

// Type exports for easier use
export type MediaRecord = typeof media.$inferSelect;
export type MediaInsert = typeof media.$inferInsert;
