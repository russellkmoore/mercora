/**
 * === Root Layout Component ===
 *
 * The main layout component that wraps all pages in the application.
 * Provides global styling, authentication context, navigation, and
 * notification systems for a consistent user experience.
 *
 * === Features ===
 * - **Global Layout**: Header, main content area, and footer structure
 * - **Authentication Provider**: Clerk authentication with dark theme
 * - **Typography**: Geist font family for modern, clean appearance
 * - **Toast Notifications**: Sonner toaster with custom orange styling
 * - **Dynamic Routing**: Force dynamic rendering for server-side auth
 * - **Responsive Design**: Mobile-first approach with proper viewport handling
 * - **SEO Optimization**: Proper metadata and semantic HTML structure
 *
 * === Technical Implementation ===
 * - **Next.js App Router**: Latest routing system with layout nesting
 * - **Clerk Integration**: Full authentication provider with custom theming
 * - **Font Optimization**: Google Fonts with variable font loading
 * - **CSS Variables**: Custom properties for consistent design system
 * - **Toast System**: Global notification system with custom positioning
 *
 * === Authentication ===
 * - ClerkProvider wraps entire app for auth context
 * - Dark theme configuration for consistent brand experience
 * - Server-side auth support with dynamic rendering
 * - User button and sign-in flows integrated globally
 *
 * === Layout Structure ===
 * - **Header**: Navigation and user controls
 * - **Main**: Page content with minimum height
 * - **Footer**: Site information and links
 * - **Toaster**: Global notification overlay
 *
 * === Usage ===
 * Automatically wraps all pages as root layout in app router
 *
 * @param children - Page content to render within layout
 * @returns JSX element with complete application layout
 */

export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PromotionalBanner from "@/components/PromotionalBanner";
import { Toaster } from "sonner";
import { dark } from "@clerk/themes";
import { Suspense } from "react";
import WebVitals from "@/components/analytics/WebVitals";
import { getStoreConfig } from "@/lib/store-config";
import { StoreConfigProvider } from "@/lib/store";

import {
  ClerkProvider,
} from "@clerk/nextjs";

// Configure primary font family with CSS variables
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Reduce initial preload burden
  weight: ["400", "500", "600"], // Only load weights we actually use
  fallback: ["system-ui", "arial"], // Better fallback strategy
});

// Configure monospace font for code and technical content
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Load on demand only
  weight: ["400"], // Single weight to minimize preload
  fallback: ["ui-monospace", "SFMono-Regular"],
});

// SEO metadata for the application
export function generateMetadata(): Metadata {
  const config = getStoreConfig();
  return {
    metadataBase: new URL(config.urls.site),
    title: config.identity.name,
    description: config.identity.description,
    other: {
      "resource-hints": "minimal",
      "mcp-server": "/api/mcp",
      "mcp-schema": "/api/mcp/schema",
      "mcp-capabilities": config.mcp.capabilities,
      "mcp-version": "1.0.0",
      "mcp-description": config.mcp.description,
    },
  };
}

// Viewport configuration (separate export in Next.js 15+)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Root layout component that wraps all application pages
 *
 * @param children - Page components to render within the layout
 * @returns Complete application layout with global providers
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getStoreConfig();
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* MCP discovery links complement the metadata emitted by generateMetadata. */}
          <link rel="mcp-server" href="/api/mcp" type="application/json" />
          <link rel="mcp-schema" href="/api/mcp/schema" type="application/json" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
          style={{
            backgroundColor: config.theme.surface,
            color: config.theme.foreground,
            "--store-primary": config.theme.primary,
            "--store-surface": config.theme.surface,
            "--store-surface-elevated": config.theme.surfaceElevated,
            "--store-foreground": config.theme.foreground,
            "--store-muted-foreground": config.theme.mutedForeground,
          } as React.CSSProperties}
          suppressHydrationWarning
        >
          <StoreConfigProvider config={config}>
          {/* Promotional banner - shown above header when enabled */}
          <Suspense fallback={null}>
            <PromotionalBanner />
          </Suspense>

          {/* Global navigation header with suspense boundary */}
          <Suspense fallback={<div className="h-16 bg-neutral-900" />}>
            <Header />
          </Suspense>

          {/* The root owns the storefront's single main landmark. */}
          <main className="flex-1" suppressHydrationWarning>
            {children}
          </main>

          {/* Global footer */}
          <Footer />

          {/* Global toast notification system */}
          <Toaster
            position="top-center"
            toastOptions={{
              className:
                "bg-(--store-primary)/80 text-black font-semibold rounded-md mt-[60px] shadow-lg animate-in fade-in slide-in-from-top-5",
              duration: 3000,
            }}
          />
          
          {/* Core Web Vitals monitoring */}
          <WebVitals />
          </StoreConfigProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
