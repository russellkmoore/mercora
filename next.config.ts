import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  // Minimal experimental config to avoid build issues
  experimental: {
    optimizePackageImports: ["@next/font"],
  },
  // Configure webpack for better performance without problematic optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Basic chunk optimization with reduced preloading
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              maxSize: 200000, // Limit chunk size to reduce preloading
            },
          },
        },
      };
    }
    return config;
  },
  // Basic headers for performance and resource loading control
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Link",
            value: "<https://fonts.googleapis.com>; rel=preconnect; crossorigin",
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
    ];
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
