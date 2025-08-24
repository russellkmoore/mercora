/**
 * MACH Alliance Open Data Model - Media
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/utilities/media.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

/**
 * MACH Alliance Open Data Model - Media Utility Object v1.0
 * 
 * A standardized utility object for representing media assets across all entities
 * in the MACH Alliance Common Data Model.
 */
export interface MACHMedia {
  // Core file information - REQUIRED
  file: MACHFile;

  // Core identification - OPTIONAL
  id?: string;
  type?: "image" | "video" | "document" | "audio" | "3d";
  status?: "draft" | "published" | "active" | "archived" | "deleted";
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601

  // Display information - OPTIONAL (localizable)
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;

  // Categorization - OPTIONAL
  tags?: string[];

  // Media variants and derivatives - OPTIONAL
  variants?: MACHMediaVariant[];
  thumbnail?: MACHFile;
  focal_point?: MACHFocalPoint;

  // Accessibility - OPTIONAL
  accessibility?: MACHAccessibility;

  // Technical metadata - OPTIONAL
  metadata?: Record<string, any>;

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Core file object with technical details
 */
export interface MACHFile {
  // Required
  url: string; // URI to access the file
  format: string; // File format/extension

  // Optional technical details
  size_bytes?: number;
  width?: number; // For images/videos
  height?: number; // For images/videos
  duration_seconds?: number; // For video/audio
  resolution?: string; // e.g., "1920x1080", "4K"
  frame_rate?: number; // For video
  bitrate_kbps?: number; // For video/audio
  audio_channels?: "mono" | "stereo" | "5.1" | "7.1";
}

/**
 * Alternative versions of media (sizes, formats, quality)
 */
export interface MACHMediaVariant {
  variant_type: string; // e.g., "responsive", "quality", "format"
  label?: string; // e.g., "small", "medium", "large", "webp", "avif"
  url: string;
  format: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  quality?: number; // 1-100
}

/**
 * Coordinates for intelligent cropping
 */
export interface MACHFocalPoint {
  x: number; // 0.0 to 1.0, left to right
  y: number; // 0.0 to 1.0, top to bottom
  description?: string; // What the focal point represents
}

/**
 * Accessibility features
 */
export interface MACHAccessibility {
  alt_text?: string; // Alternative text for screen readers
  long_description?: string; // Extended description for complex images
  decorative?: boolean; // Whether the image is purely decorative
  transcript?: string; // Text transcript (for video/audio)
  captions_url?: string; // URL to caption file (for video)
}

// Type guards for media type discrimination
export function isImageMedia(media: MACHMedia): boolean {
  return media.type === "image" || media.type === undefined;
}

export function isVideoMedia(media: MACHMedia): boolean {
  return media.type === "video";
}

export function isDocumentMedia(media: MACHMedia): boolean {
  return media.type === "document";
}

export function isAudioMedia(media: MACHMedia): boolean {
  return media.type === "audio";
}

export function is3DMedia(media: MACHMedia): boolean {
  return media.type === "3d";
}

export function isPublishedMedia(media: MACHMedia): boolean {
  return media.status === "published" || media.status === "active";
}

// Sample objects for reference

/**
 * Sample minimal media
 */
export const sampleMinimalMedia: MACHMedia = {
  file: {
    url: "https://cdn.example.com/assets/product.jpg",
    format: "jpg"
  }
};

/**
 * Sample product image
 */
export const sampleProductImage: MACHMedia = {
  id: "MEDIA-IMG-001987",
  type: "image",
  status: "published",
  external_references: {
    pim_id: "pim-99871",
    dam_id: "asset-1842356",
    cms_id: "entry-9d22bfa"
  },
  created_at: "2024-07-08T13:00:00Z",
  updated_at: "2024-07-09T09:15:00Z",
  title: "Yellow MACH Alliance T-Shirt Front View",
  description: "Studio image of a yellow MACH Alliance t-shirt with a small embroidered logo on the left chest, photographed on a clean white background.",
  tags: ["mach-alliance", "tshirt", "yellow", "apparel", "branded", "merchandise"],
  file: {
    url: "https://cdn.example.com/assets/img-001987.webp",
    format: "webp",
    size_bytes: 1032840,
    width: 2400,
    height: 1600
  },
  variants: [
    {
      variant_type: "responsive",
      label: "small",
      url: "https://cdn.example.com/assets/img-001987-sm.webp",
      format: "webp",
      size_bytes: 125000,
      width: 600,
      height: 400
    },
    {
      variant_type: "responsive",
      label: "medium",
      url: "https://cdn.example.com/assets/img-001987-md.webp",
      format: "webp",
      size_bytes: 425000,
      width: 1200,
      height: 800
    },
    {
      variant_type: "format",
      label: "jpeg",
      url: "https://cdn.example.com/assets/img-001987.jpg",
      format: "jpg",
      size_bytes: 1548000,
      width: 2400,
      height: 1600,
      quality: 85
    }
  ],
  thumbnail: {
    url: "https://cdn.example.com/assets/img-001987-thumb.webp",
    format: "webp",
    size_bytes: 85240,
    width: 480,
    height: 320
  },
  focal_point: {
    x: 0.32,
    y: 0.35,
    description: "Center of the embroidered MACH Alliance logo on the left chest"
  },
  accessibility: {
    alt_text: "Yellow MACH Alliance t-shirt with a small embroidered logo on the chest",
    long_description: "This is a high-resolution studio photograph of a bright yellow t-shirt, laid flat against a white background. The shirt features a subtle MACH Alliance embroidered logo in black, located on the left chest area. The fabric texture and stitching are clearly visible, and the lighting is balanced to emphasize detail without shadows.",
    decorative: false
  },
  metadata: {
    exif: {
      camera: "Canon EOS 5D Mark IV",
      lens: "24-70mm f/2.8",
      iso: 100,
      aperture: "f/8",
      shutter_speed: "1/125"
    },
    color_profile: "sRGB",
    dpi: 300
  },
  extensions: {
    rights: {
      copyright: "© 2024 MACH Alliance",
      usage_terms: "Unlimited commercial and editorial use. No expiration.",
      creator: "Adam Peter Nielsen",
      expires: null
    },
    associations: {
      product_ids: ["MACH-TSHIRT-YELLOW-2024"],
      categories: ["merch", "apparel", "mach-alliance"]
    },
    seo: {
      keywords: ["mach alliance", "yellow t-shirt", "branded merchandise"],
      schema_type: "ImageObject"
    }
  }
};

/**
 * Sample product video
 */
export const sampleProductVideo: MACHMedia = {
  id: "MEDIA-VID-000561",
  type: "video",
  status: "active",
  external_references: {
    pim_id: "pim-vid-23391",
    dam_id: "asset-vid-8090",
    youtube_id: "dQw4w9WgXcQ",
    cms_id: "entry-bv9d85dd"
  },
  created_at: "2024-07-01T09:20:00Z",
  updated_at: "2024-07-09T08:35:00Z",
  title: "How to Assemble the MACH Alliance Trophy",
  description: "Step-by-step tutorial video showing how to unpack and assemble the MACH Alliance trophy.",
  tags: ["assembly", "mach-alliance", "tutorial", "how-to", "product-guide"],
  file: {
    url: "https://cdn.example.com/assets/vid-000561.mp4",
    format: "mp4",
    size_bytes: 104328304,
    duration_seconds: 148,
    width: 1920,
    height: 1080,
    resolution: "1920x1080",
    frame_rate: 30,
    bitrate_kbps: 4500,
    audio_channels: "stereo"
  },
  variants: [
    {
      variant_type: "quality",
      label: "720p",
      url: "https://cdn.example.com/assets/vid-000561-720p.mp4",
      format: "mp4",
      size_bytes: 52164152,
      width: 1280,
      height: 720
    },
    {
      variant_type: "quality",
      label: "480p",
      url: "https://cdn.example.com/assets/vid-000561-480p.mp4",
      format: "mp4",
      size_bytes: 31298592,
      width: 854,
      height: 480
    },
    {
      variant_type: "format",
      label: "webm",
      url: "https://cdn.example.com/assets/vid-000561.webm",
      format: "webm",
      size_bytes: 89280000,
      width: 1920,
      height: 1080
    }
  ],
  thumbnail: {
    url: "https://cdn.example.com/assets/thumbnails/vid-000561-thumb.webp",
    format: "webp",
    size_bytes: 78412,
    width: 640,
    height: 360
  },
  accessibility: {
    alt_text: "Video tutorial showing MACH Alliance trophy assembly",
    transcript: "Full transcript available at /transcripts/vid-000561.txt",
    captions_url: "https://cdn.example.com/captions/vid-000561.vtt",
    decorative: false
  },
  extensions: {
    rights: {
      copyright: "© 2024 MACH Alliance",
      usage_terms: "Unlimited commercial use across owned and third-party platforms. Attribution not required.",
      expires: null
    },
    associations: {
      product_ids: ["MACH-TROPHY-2024"],
      categories: ["tutorials", "support", "video-content"]
    },
    playback: {
      autoplay: false,
      default_playback_speed: 1.0,
      available_speeds: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
      chapters: [
        { title: "Introduction", start_time: 0 },
        { title: "Unboxing", start_time: 15 },
        { title: "Assembly Steps", start_time: 45 },
        { title: "Final Result", start_time: 120 }
      ],
      platforms: {
        youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        vimeo: "https://vimeo.com/123456789"
      }
    }
  }
};
