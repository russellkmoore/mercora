/**
 * === Cloudflare Image Loader ===
 *
 * Custom Next.js image loader that integrates with Cloudflare's Image
 * Resizing service for optimized image delivery with automatic format
 * conversion and quality adjustments.
 *
 * === Features ===
 * - **Cloudflare Integration**: Uses Cloudflare's image transformation API
 * - **Development Mode**: Bypasses optimization during local development
 * - **Auto Format**: Automatically serves WebP/AVIF when supported
 * - **Quality Control**: Configurable image quality with intelligent defaults
 * - **Path Normalization**: Handles relative and absolute path formats
 * - **CDN Optimization**: Leverages Cloudflare's global edge network
 *
 * === Technical Implementation ===
 * - **Environment Detection**: Different behavior for dev vs production
 * - **URL Construction**: Builds Cloudflare image transformation URLs
 * - **Parameter Encoding**: Properly formats width, quality, and format params
 * - **Source Handling**: Normalizes image paths for consistent processing
 *
 * === Cloudflare Image Parameters ===
 * - **width**: Target image width for responsive sizing
 * - **format=auto**: Automatic format selection (WebP/AVIF/JPEG)
 * - **quality**: Compression quality (1-100, optimized for web delivery)
 *
 * === Usage ===
 * Configured in next.config.ts as the default image loader:
 * ```typescript
 * images: {
 *   loader: 'custom',
 *   loaderFile: './image-loader.ts'
 * }
 * ```
 *
 * === Performance Benefits ===
 * - Automatic format optimization reduces file sizes by 30-50%
 * - Edge caching provides sub-50ms image delivery globally
 * - Dynamic resizing eliminates need for multiple image variants
 * - Progressive JPEG/WebP loading improves perceived performance
 */

// image-loader.ts
import type { ImageLoaderProps } from "next/image";

/**
 * Normalize image source path by removing leading slash
 * 
 * @param src - Image source path (absolute or relative)
 * @returns Normalized path without leading slash
 */
function imageCdn() {
  const value = process.env.NEXT_PUBLIC_IMAGE_CDN?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function toObjectKey(src: string, cdn: string | undefined) {
  if (cdn && src.startsWith(cdn)) return src.slice(cdn.length).replace(/^\//, "");
  if (/^https?:\/\//.test(src)) return null;
  return src.replace(/^\//, "");
}

/**
 * Cloudflare image loader for Next.js Image component
 * 
 * @param src - Image source URL or path
 * @param width - Target width for responsive images
 * @param quality - Optional image quality (1-100)
 * @returns Optimized Cloudflare image URL or original src in development
 */
export default function cloudflareLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  // Read public configuration at invocation time. Import-time environment reads
  // can capture a different build's configuration.
  if (process.env.NODE_ENV === "development") {
    return src;
  }

  if (src.startsWith("/placeholder") || src.startsWith("/logo")) return src;
  const cdn = imageCdn();
  const key = toObjectKey(src, cdn);
  if (key === null) return src;
  if (!cdn) return `/media/${key}`;
  if (process.env.NEXT_PUBLIC_IMAGE_TRANSFORMS === "false") return `${cdn}/${key}`;

  const params = [`width=${width}`, "format=auto"];
  if (quality) params.push(`quality=${quality}`);
  return `${cdn}/cdn-cgi/image/${params.join(",")}/${key}`;
}
