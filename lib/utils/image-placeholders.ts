/**
 * === Image Blur Placeholders ===
 * 
 * Consistent blur placeholders for Next.js Image components that match
 * the dark theme color scheme. Prevents blue placeholder flashes.
 */

// Dark theme blur placeholder - matches neutral-700 background
export const DARK_BLUR_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgZmlsbD0iIzM3Mzc0MSIvPgogIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjExMi41IiByPSIzMCIgZmlsbD0iIzUyNTI1NyIgb3BhY2l0eT0iMC41Ii8+Cjwvc3ZnPg==";

// Alternative shimmer effect placeholder
export const SHIMMER_BLUR_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyI+CiAgICAgIDxzdG9wIHN0b3AtY29sb3I9IiMzNzM3NDEiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIuNSIgc3RvcC1jb2xvcj0iIzUyNTI1NyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzNzM3NDEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjI1IiBmaWxsPSJ1cmwoI2cpIi8+Cjwvc3ZnPgo=";

/**
 * Returns the appropriate blur placeholder for dark theme images
 */
export function getDarkBlurPlaceholder(): string {
  return DARK_BLUR_PLACEHOLDER;
}

/**
 * The SVG source for the dark blur placeholder (for reference):
 * 
 * <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
 *   <rect width="400" height="225" fill="#373741"/>
 *   <circle cx="200" cy="112.5" r="30" fill="#525257" opacity="0.5"/>
 * </svg>
 * 
 * This creates a neutral-700 (#373741) background with a subtle circle
 * that matches the existing color scheme.
 */
