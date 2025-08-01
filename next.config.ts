import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  // Performance and resource optimization
  experimental: {
    optimizePackageImports: ["@next/font"],
    optimizeCss: true,
    // Enable optimizations
    turbo: {
      loaders: {
        '.svg': ['@svgr/webpack'],
      },
    },
  },
  // Optimize build performance
  swcMinify: true,
  // Configure webpack for better performance
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Reduce preload aggressive behavior
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Optimize vendor chunks
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate large libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
          },
        },
      };
    }
    
    // Enable production optimizations in development for testing
    if (!dev) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    
    return config;
  },
  // Optimize resource hints and headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Link",
            value: "rel=preconnect; href=https://fonts.googleapis.com; crossorigin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      // Cache static assets longer
      {
        source: "/images/:path*",
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
