import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  // Minimal experimental config to avoid build issues
  experimental: {
    optimizePackageImports: ["@next/font"],
  },
  // Keep Next's stock chunking. A broad `chunks: "all"` cache group can attach
  // dependency CSS to the main app entry and cause it to be served as script.
  // Basic headers for performance and resource loading control
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...buildSecurityHeaders(process.env),
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // Reduce resource hints aggressiveness
          {
            key: "X-Resource-Hint-Control",
            value: "conservative",
          },
          // Suppress browser preload warnings
          {
            key: "Link-Policy",
            value: "suppress-warnings",
          },
        ],
      },
      {
        // Specific headers for static assets to prevent over-eager preloading
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Prevent preloading of non-critical webpack chunks
        source: "/_next/static/chunks/webpack-(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
