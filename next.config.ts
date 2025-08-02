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
              maxSize: 150000, // Smaller chunks to reduce preloading
            },
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              chunks: 'all',
              maxSize: 100000, // Keep common chunks small
            },
          },
        },
      };
      
      // Reduce module concatenation which can cause larger chunks
      config.optimization.concatenateModules = false;
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
          // Allow New Relic beacon requests
          {
            key: "Content-Security-Policy",
            value: "connect-src 'self' https://bam.nr-data.net https://js-agent.newrelic.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js-agent.newrelic.com;",
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
initOpenNextCloudflareForDev();
