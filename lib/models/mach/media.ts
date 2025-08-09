/**
 * MACH Alliance Open Data Model - Media Business Operations
 * 
 * Comprehensive business logic layer for Media utility object operations.
 * Supports all media types (image, video, document, audio, 3D) with variants,
 * accessibility features, and comprehensive asset management.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/utilities/media.md
 */

import { and, eq, inArray, sql, desc, asc, like, isNull, isNotNull } from "drizzle-orm";
import { getDbAsync } from "../../db";
import { media, type MediaRecord, type MediaInsert } from "../../db/schema/media";
import type { 
  MACHMedia,
  MACHFile,
  MACHMediaVariant,
  MACHFocalPoint,
  MACHAccessibility
} from "../../types/mach/Media";
import { 
  transformFromMACHMedia, 
  transformToMACHMedia,
  generateMediaId,
  validateMediaFile,
  validateMediaVariant,
  validateFocalPoint,
  validateAccessibility,
  getMediaTypeFromFormat,
  supportsImageDimensions,
  supportsDuration,
  generateResponsiveVariants,
  generateFormatVariants,
  getSupportedFormats,
  isFormatSupported,
  getWebOptimizedFormats,
  extractFileExtension
} from "../../db/schema/media";

// ====================================
// Core Media Operations
// ====================================

/**
 * Create a new media asset
 */
export async function createMedia(
  mediaData: Partial<MACHMedia> & Pick<MACHMedia, 'file'>
): Promise<MACHMedia> {
  // Validate required file object
  if (!validateMediaFile(mediaData.file)) {
    throw new Error('Invalid file object: must have url and format');
  }

  // Auto-detect media type from format if not provided
  const detectedType = mediaData.type || getMediaTypeFromFormat(mediaData.file.format);
  
  // Validate format for media type
  if (!isFormatSupported(mediaData.file.format, detectedType)) {
    throw new Error(`Format '${mediaData.file.format}' is not supported for media type '${detectedType}'`);
  }

  // Validate variants if provided
  if (mediaData.variants) {
    for (const variant of mediaData.variants) {
      if (!validateMediaVariant(variant)) {
        throw new Error(`Invalid variant: ${variant.label || 'unnamed'}`);
      }
    }
  }

  // Validate focal point if provided
  if (mediaData.focal_point && !validateFocalPoint(mediaData.focal_point)) {
    throw new Error('Invalid focal point: coordinates must be between 0.0 and 1.0');
  }

  // Validate accessibility features if provided
  if (mediaData.accessibility) {
    const accessibilityErrors = validateAccessibility(mediaData.accessibility);
    if (accessibilityErrors.length > 0) {
      throw new Error(`Accessibility validation failed: ${accessibilityErrors.join(', ')}`);
    }
  }

  const now = new Date().toISOString();
  const mediaAsset: MACHMedia = {
    id: mediaData.id || generateMediaId(),
    type: detectedType,
    status: mediaData.status || 'active',
    external_references: mediaData.external_references,
    created_at: now,
    updated_at: now,
    title: mediaData.title,
    description: mediaData.description,
    tags: mediaData.tags,
    file: mediaData.file,
    variants: mediaData.variants,
    thumbnail: mediaData.thumbnail,
    focal_point: mediaData.focal_point,
    accessibility: mediaData.accessibility,
    metadata: mediaData.metadata,
    extensions: mediaData.extensions,
  };

  const record = transformFromMACHMedia(mediaAsset);
  
  try {
    const db = await getDbAsync();
    await db.insert(media).values(record);
    return mediaAsset;
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Media asset with ID '${mediaAsset.id}' already exists`);
    }
    throw error;
  }
}

/**
 * Get media asset by ID
 */
export async function getMediaById(id: string): Promise<MACHMedia | null> {
  const db = await getDbAsync();
  const records = await db
    .select()
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  return records.length > 0 ? transformToMACHMedia(records[0]) : null;
}

/**
 * Update media asset
 */
export async function updateMedia(
  id: string,
  updates: Partial<Omit<MACHMedia, 'id' | 'created_at'>>
): Promise<MACHMedia | null> {
  // Validate file updates
  if (updates.file && !validateMediaFile(updates.file)) {
    throw new Error('Invalid file object: must have url and format');
  }

  // Validate variants if provided
  if (updates.variants) {
    for (const variant of updates.variants) {
      if (!validateMediaVariant(variant)) {
        throw new Error(`Invalid variant: ${variant.label || 'unnamed'}`);
      }
    }
  }

  // Validate focal point if provided
  if (updates.focal_point && !validateFocalPoint(updates.focal_point)) {
    throw new Error('Invalid focal point: coordinates must be between 0.0 and 1.0');
  }

  // Validate accessibility features if provided
  if (updates.accessibility) {
    const accessibilityErrors = validateAccessibility(updates.accessibility);
    if (accessibilityErrors.length > 0) {
      throw new Error(`Accessibility validation failed: ${accessibilityErrors.join(', ')}`);
    }
  }

  const existing = await getMediaById(id);
  if (!existing) {
    return null;
  }

  const updated: MACHMedia = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Auto-detect media type if file format changed
  if (updates.file && updates.file.format !== existing.file.format) {
    updated.type = updates.type || getMediaTypeFromFormat(updates.file.format);
  }

  const record = transformFromMACHMedia(updated);
  
  const db = await getDbAsync();
  await db
    .update(media)
    .set(record)
    .where(eq(media.id, id));

  return updated;
}

/**
 * Delete media asset
 */
export async function deleteMedia(id: string): Promise<boolean> {
  const db = await getDbAsync();
  await db
    .delete(media)
    .where(eq(media.id, id));

  return true;
}

/**
 * Soft delete media asset (mark as deleted)
 */
export async function softDeleteMedia(id: string): Promise<MACHMedia | null> {
  return updateMedia(id, { 
    status: 'deleted',
    updated_at: new Date().toISOString()
  });
}

/**
 * List media assets with filtering and pagination
 */
export async function listMedia(options?: {
  type?: MACHMedia['type'];
  status?: MACHMedia['status'];
  tags?: string[];
  format?: string;
  hasVariants?: boolean;
  hasThumbnail?: boolean;
  hasAccessibility?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'type' | 'status';
  sortOrder?: 'asc' | 'desc';
}): Promise<MACHMedia[]> {
  const db = await getDbAsync();
  let query = db.select().from(media);

  // Apply filters
  const conditions = [];
  
  if (options?.type) {
    conditions.push(eq(media.type, options.type));
  }
  
  if (options?.status) {
    conditions.push(eq(media.status, options.status));
  }

  if (options?.hasVariants !== undefined) {
    if (options.hasVariants) {
      conditions.push(isNotNull(media.variants));
    } else {
      conditions.push(isNull(media.variants));
    }
  }

  if (options?.hasThumbnail !== undefined) {
    if (options.hasThumbnail) {
      conditions.push(isNotNull(media.thumbnail));
    } else {
      conditions.push(isNull(media.thumbnail));
    }
  }

  if (options?.hasAccessibility !== undefined) {
    if (options.hasAccessibility) {
      conditions.push(isNotNull(media.accessibility));
    } else {
      conditions.push(isNull(media.accessibility));
    }
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Apply sorting
  const sortField = options?.sortBy || 'updated_at';
  const sortDir = options?.sortOrder || 'desc';
  
  switch (sortField) {
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(media.createdAt) : desc(media.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(media.updatedAt) : desc(media.updatedAt)) as typeof query;
      break;
    case 'type':
      query = query.orderBy(sortDir === 'asc' ? asc(media.type) : desc(media.type)) as typeof query;
      break;
    case 'status':
      query = query.orderBy(sortDir === 'asc' ? asc(media.status) : desc(media.status)) as typeof query;
      break;
  }

  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const records = await query;
  return records.map(transformToMACHMedia);
}

// ====================================
// Media Type Specific Operations
// ====================================

/**
 * Get all image assets
 */
export async function getImages(options?: {
  status?: MACHMedia['status'];
  hasVariants?: boolean;
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  return listMedia({ ...options, type: 'image' });
}

/**
 * Get all video assets
 */
export async function getVideos(options?: {
  status?: MACHMedia['status'];
  hasVariants?: boolean;
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  return listMedia({ ...options, type: 'video' });
}

/**
 * Get all document assets
 */
export async function getDocuments(options?: {
  status?: MACHMedia['status'];
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  return listMedia({ ...options, type: 'document' });
}

/**
 * Get all audio assets
 */
export async function getAudio(options?: {
  status?: MACHMedia['status'];
  hasVariants?: boolean;
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  return listMedia({ ...options, type: 'audio' });
}

/**
 * Get all 3D model assets
 */
export async function get3DModels(options?: {
  status?: MACHMedia['status'];
  hasVariants?: boolean;
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  return listMedia({ ...options, type: '3d' });
}

// ====================================
// Media Variant Operations
// ====================================

/**
 * Add variant to existing media asset
 */
export async function addMediaVariant(
  id: string,
  variant: MACHMediaVariant
): Promise<MACHMedia | null> {
  if (!validateMediaVariant(variant)) {
    throw new Error(`Invalid variant: ${variant.label || 'unnamed'}`);
  }

  const existing = await getMediaById(id);
  if (!existing) {
    return null;
  }

  const variants = existing.variants || [];
  
  // Check for duplicate variant
  const existingVariant = variants.find(v => 
    v.variant_type === variant.variant_type && v.label === variant.label
  );
  
  if (existingVariant) {
    throw new Error(`Variant with type '${variant.variant_type}' and label '${variant.label}' already exists`);
  }

  variants.push(variant);
  
  return updateMedia(id, { variants });
}

/**
 * Remove variant from media asset
 */
export async function removeMediaVariant(
  id: string,
  variantType: string,
  label?: string
): Promise<MACHMedia | null> {
  const existing = await getMediaById(id);
  if (!existing || !existing.variants) {
    return null;
  }

  const variants = existing.variants.filter(v => {
    if (v.variant_type !== variantType) return true;
    if (label && v.label !== label) return true;
    return false;
  });

  return updateMedia(id, { 
    variants: variants.length > 0 ? variants : undefined 
  });
}

/**
 * Generate responsive image variants
 */
export async function generateResponsiveImageVariants(
  id: string,
  sizes: { label: string; width: number; height: number }[]
): Promise<MACHMedia | null> {
  const existing = await getMediaById(id);
  if (!existing || existing.type !== 'image') {
    return null;
  }

  const responsiveVariants = generateResponsiveVariants(
    existing.file.url,
    existing.file.format,
    sizes
  );

  const allVariants = [
    ...(existing.variants || []).filter(v => v.variant_type !== 'responsive'),
    ...responsiveVariants
  ];

  return updateMedia(id, { variants: allVariants });
}

/**
 * Generate format variants
 */
export async function generateMediaFormatVariants(
  id: string,
  targetFormats: string[]
): Promise<MACHMedia | null> {
  const existing = await getMediaById(id);
  if (!existing) {
    return null;
  }

  // Validate target formats for media type
  for (const format of targetFormats) {
    if (!isFormatSupported(format, existing.type)) {
      throw new Error(`Format '${format}' is not supported for media type '${existing.type}'`);
    }
  }

  const formatVariants = generateFormatVariants(
    existing.file.url,
    existing.file.format,
    targetFormats
  );

  const allVariants = [
    ...(existing.variants || []).filter(v => v.variant_type !== 'format'),
    ...formatVariants
  ];

  return updateMedia(id, { variants: allVariants });
}

// ====================================
// Media Search and Discovery
// ====================================

/**
 * Search media by tags
 */
export async function searchMediaByTags(
  tags: string[],
  options?: {
    type?: MACHMedia['type'];
    status?: MACHMedia['status'];
    matchAll?: boolean; // true = AND, false = OR
    limit?: number;
    offset?: number;
  }
): Promise<MACHMedia[]> {
  // Note: This is a simplified implementation
  // In production, you'd want proper full-text search or JSON array querying
  const allMedia = await listMedia({
    type: options?.type,
    status: options?.status,
    limit: options?.limit,
    offset: options?.offset
  });

  return allMedia.filter(mediaAsset => {
    if (!mediaAsset.tags || mediaAsset.tags.length === 0) return false;
    
    if (options?.matchAll) {
      // All tags must be present
      return tags.every(tag => mediaAsset.tags!.includes(tag));
    } else {
      // At least one tag must be present
      return tags.some(tag => mediaAsset.tags!.includes(tag));
    }
  });
}

/**
 * Search media by title or description
 */
export async function searchMediaByText(
  searchTerm: string,
  options?: {
    type?: MACHMedia['type'];
    status?: MACHMedia['status'];
    limit?: number;
    offset?: number;
  }
): Promise<MACHMedia[]> {
  // Note: This is a simplified implementation
  // In production, you'd want proper full-text search
  const allMedia = await listMedia({
    type: options?.type,
    status: options?.status,
    limit: options?.limit,
    offset: options?.offset
  });

  const lowerSearchTerm = searchTerm.toLowerCase();

  return allMedia.filter(mediaAsset => {
    // Search in title
    if (mediaAsset.title) {
      const titleText = typeof mediaAsset.title === 'string' 
        ? mediaAsset.title 
        : Object.values(mediaAsset.title).join(' ');
      
      if (titleText.toLowerCase().includes(lowerSearchTerm)) {
        return true;
      }
    }

    // Search in description
    if (mediaAsset.description) {
      const descText = typeof mediaAsset.description === 'string' 
        ? mediaAsset.description 
        : Object.values(mediaAsset.description).join(' ');
      
      if (descText.toLowerCase().includes(lowerSearchTerm)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Find media by external reference
 */
export async function findMediaByExternalReference(
  systemId: string,
  referenceValue: string
): Promise<MACHMedia[]> {
  // Note: In production, you'd use JSON query functions
  const allMedia = await listMedia();

  return allMedia.filter(mediaAsset => {
    return mediaAsset.external_references && 
           mediaAsset.external_references[systemId] === referenceValue;
  });
}

// ====================================
// Media Status Management
// ====================================

/**
 * Publish media asset
 */
export async function publishMedia(id: string): Promise<MACHMedia | null> {
  return updateMedia(id, { 
    status: 'published',
    updated_at: new Date().toISOString()
  });
}

/**
 * Archive media asset
 */
export async function archiveMedia(id: string): Promise<MACHMedia | null> {
  return updateMedia(id, { 
    status: 'archived',
    updated_at: new Date().toISOString()
  });
}

/**
 * Activate media asset
 */
export async function activateMedia(id: string): Promise<MACHMedia | null> {
  return updateMedia(id, { 
    status: 'active',
    updated_at: new Date().toISOString()
  });
}

/**
 * Get published/active media assets
 */
export async function getPublishedMedia(options?: {
  type?: MACHMedia['type'];
  limit?: number;
  offset?: number;
}): Promise<MACHMedia[]> {
  const db = await getDbAsync();
  let query = db.select().from(media);

  const conditions = [
    sql`${media.status} IN ('published', 'active')`
  ];

  if (options?.type) {
    conditions.push(eq(media.type, options.type));
  }

  query = query.where(and(...conditions)) as typeof query;
  query = query.orderBy(desc(media.updatedAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const records = await query;
  return records.map(transformToMACHMedia);
}

// ====================================
// Accessibility Operations
// ====================================

/**
 * Update accessibility features
 */
export async function updateMediaAccessibility(
  id: string,
  accessibility: Partial<MACHAccessibility>
): Promise<MACHMedia | null> {
  const existing = await getMediaById(id);
  if (!existing) {
    return null;
  }

  const updatedAccessibility: MACHAccessibility = {
    ...existing.accessibility,
    ...accessibility,
  };

  // Validate updated accessibility
  const errors = validateAccessibility(updatedAccessibility);
  if (errors.length > 0) {
    throw new Error(`Accessibility validation failed: ${errors.join(', ')}`);
  }

  return updateMedia(id, { accessibility: updatedAccessibility });
}

/**
 * Get media assets missing accessibility features
 */
export async function getMediaMissingAccessibility(): Promise<MACHMedia[]> {
  const allMedia = await listMedia({ status: 'active' });
  
  return allMedia.filter(mediaAsset => {
    if (!mediaAsset.accessibility) return true;
    
    // Check for images without alt text
    if (mediaAsset.type === 'image') {
      return !mediaAsset.accessibility.alt_text && !mediaAsset.accessibility.decorative;
    }
    
    // Check for videos without captions or transcripts
    if (mediaAsset.type === 'video') {
      return !mediaAsset.accessibility.captions_url && !mediaAsset.accessibility.transcript;
    }
    
    // Check for audio without transcripts
    if (mediaAsset.type === 'audio') {
      return !mediaAsset.accessibility.transcript;
    }
    
    return false;
  });
}

// ====================================
// Media Statistics and Analytics
// ====================================

/**
 * Get comprehensive media statistics
 */
export async function getMediaStatistics(): Promise<{
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  with_variants: number;
  with_thumbnails: number;
  with_accessibility: number;
  missing_accessibility: number;
  total_file_size: number;
}> {
  const db = await getDbAsync();
  const allRecords = await db.select().from(media);
  const allMedia = allRecords.map(transformToMACHMedia);
  
  const total = allMedia.length;
  
  // Count by type
  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  
  let with_variants = 0;
  let with_thumbnails = 0;
  let with_accessibility = 0;
  let missing_accessibility = 0;
  let total_file_size = 0;
  
  for (const mediaAsset of allMedia) {
    // Count by type
    by_type[mediaAsset.type || 'unknown'] = (by_type[mediaAsset.type || 'unknown'] || 0) + 1;
    
    // Count by status
    by_status[mediaAsset.status || 'unknown'] = (by_status[mediaAsset.status || 'unknown'] || 0) + 1;
    
    // Count features
    if (mediaAsset.variants && mediaAsset.variants.length > 0) {
      with_variants++;
    }
    
    if (mediaAsset.thumbnail) {
      with_thumbnails++;
    }
    
    if (mediaAsset.accessibility && (
      mediaAsset.accessibility.alt_text || 
      mediaAsset.accessibility.transcript ||
      mediaAsset.accessibility.captions_url
    )) {
      with_accessibility++;
    } else if (mediaAsset.type === 'image' || mediaAsset.type === 'video' || mediaAsset.type === 'audio') {
      missing_accessibility++;
    }
    
    // Sum file sizes
    if (mediaAsset.file.size_bytes) {
      total_file_size += mediaAsset.file.size_bytes;
    }
  }
  
  return {
    total,
    by_type,
    by_status,
    with_variants,
    with_thumbnails,
    with_accessibility,
    missing_accessibility,
    total_file_size,
  };
}

// ====================================
// Bulk Operations
// ====================================

/**
 * Create multiple media assets
 */
export async function createMediaAssets(
  mediaDataList: (Partial<MACHMedia> & Pick<MACHMedia, 'file'>)[]
): Promise<MACHMedia[]> {
  const createdMedia: MACHMedia[] = [];
  
  for (const mediaData of mediaDataList) {
    try {
      const created = await createMedia(mediaData);
      createdMedia.push(created);
    } catch (error) {
      console.error(`Failed to create media asset:`, error);
      // Continue with other assets
    }
  }
  
  return createdMedia;
}

/**
 * Update multiple media assets
 */
export async function updateMediaAssets(
  updates: { id: string; data: Partial<Omit<MACHMedia, 'id' | 'created_at'>> }[]
): Promise<MACHMedia[]> {
  const updatedMedia: MACHMedia[] = [];
  
  for (const { id, data } of updates) {
    const updated = await updateMedia(id, data);
    if (updated) {
      updatedMedia.push(updated);
    }
  }
  
  return updatedMedia;
}

/**
 * Delete multiple media assets
 */
export async function deleteMediaAssets(ids: string[]): Promise<number> {
  const db = await getDbAsync();
  await db
    .delete(media)
    .where(inArray(media.id, ids));

  return ids.length;
}

/**
 * Bulk update status for multiple media assets
 */
export async function bulkUpdateMediaStatus(
  ids: string[],
  status: MACHMedia['status']
): Promise<number> {
  const db = await getDbAsync();
  await db
    .update(media)
    .set({ 
      status,
      updatedAt: new Date().toISOString()
    })
    .where(inArray(media.id, ids));

  return ids.length;
}
