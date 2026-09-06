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
 * - **Typography**: Geist font family plus an on-demand display face
 *   (Cormorant Garamond) that theme files reference without loading it
 *   themselves
 * - **Toast Notifications**: Sonner toaster with custom orange styling
 * - **Dynamic Routing**: Force dynamic rendering for server-side auth
 * - **Responsive Design**: Mobile-first approach with proper viewport handling
 * - **SEO Optimization**: Proper metadata and semantic HTML structure
 *
 * === Technical Implementation ===
 * - **Next.js App Router**: Latest routing system with layout nesting
 * - **Clerk Integration**: Full authentication provider with custom theming
 * - **Active Theming**: Async component that resolves the active theme
 *   server-side (D1 -> env default -> manifest default, see
 *   lib/themes/active-theme.ts) and stamps it on the html element before
 *   any HTML is returned — never behind a Suspense boundary
 * - **Font Optimization**: Google Fonts with variable font loading; the
 *   display face never preloads, so only a page actually rendering it pays
 *   for the fetch
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
import { Cormorant_Garamond, Fraunces, Geist, Geist_Mono, Nunito, Orbitron } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PromotionalBanner from "@/components/PromotionalBanner";
import { StorefrontToaster } from "@/components/StorefrontToaster";
import { dark } from "@clerk/themes";
import { Suspense } from "react";
import WebVitals from "@/components/analytics/WebVitals";
import { getStoreConfig, toPublicStoreConfig } from "@/lib/store-config";
import { getThemeTokens } from "@/lib/themes/tokens";
import { getActiveTheme } from "@/lib/themes/active-theme";
import { StoreConfigProvider } from "@/lib/store";
import SubscriptionSetupReturnHandler from "@/components/subscriptions/SubscriptionSetupReturnHandler";

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

// Display face for themes whose --store-font-display references it (e.g.
// Luxe). Loaded once here so no theme file ever needs a font-loading
// at-rule (D-02). preload stays off: a page that never renders text in
// this face pays nothing extra; the browser only fetches it when a
// [data-theme] block that references the variable actually renders text.
// Weights extend the original 400/500 to 600 and 700 (Google's Cormorant
// Garamond tops out at 700) so the storefront's font-semibold/bold/extrabold
// headings render at a loaded weight instead of a synthesized one
// (font-synthesis: none in app/globals.css). font-extrabold requests still
// resolve to 700 rather than a true 800 — an acceptable nearest-match, unlike
// the previous 500 ceiling.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// Display face for themes whose --store-font-display references it (retro).
// Loaded once here so no theme file ever needs a font-loading at-rule
// (D-02). preload stays off: a page that never renders text in this face
// pays nothing extra; the browser only fetches it when a [data-theme]
// block that references the variable actually renders text. Weights
// extend the UI-SPEC floor (600, 700) with 800 so the storefront's
// font-extrabold headings render at a loaded weight instead of a
// synthesized one (font-synthesis: none in app/globals.css).
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  preload: false,
});

// Display face for themes whose --store-font-display references it
// (atelier). Loaded once here so no theme file ever needs a font-loading
// at-rule (D-02). preload stays off: a page that never renders text in
// this face pays nothing extra; the browser only fetches it when a
// [data-theme] block that references the variable actually renders text.
// Weights extend the UI-SPEC floor (500) with 600, 700 and 800 so the
// storefront's font-semibold/font-bold/font-extrabold headings all
// render at a loaded weight instead of a synthesized one.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

// Display face for themes whose --store-font-display references it
// (market). Loaded once here so no theme file ever needs a font-loading
// at-rule (D-02). preload stays off: a page that never renders text in
// this face pays nothing extra; the browser only fetches it when a
// [data-theme] block that references the variable actually renders text.
// Weights extend the UI-SPEC floor (700) with 600 and 800 so the
// storefront's font-semibold/font-extrabold headings render at a loaded
// weight instead of a synthesized one.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  preload: false,
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
 * Root layout component that wraps all application pages.
 *
 * Async so the active theme can be resolved server-side, blocking, before
 * any HTML is returned (never wrapped in Suspense — RESEARCH Pitfall 3):
 * the resolved name must already be on the html element in the first byte
 * of the response, or the browser paints before the matching
 * [data-theme] CSS block exists.
 *
 * @param children - Page components to render within the layout
 * @returns Complete application layout with global providers
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getStoreConfig();
  const activeTheme = await getActiveTheme();
  const themeTokens = getThemeTokens(activeTheme);
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorPrimary: themeTokens.primary,
          colorPrimaryForeground: themeTokens.onPrimary,
          colorBackground: themeTokens.surfaceElevated,
          colorForeground: themeTokens.foreground,
          colorMutedForeground: themeTokens.mutedForeground,
          colorBorder: themeTokens.border,
          colorNeutral: themeTokens.border,
          colorDanger: themeTokens.danger,
          colorSuccess: themeTokens.success,
          colorWarning: themeTokens.warning,
        },
      }}
    >
      <html
        lang="en"
        data-theme={activeTheme}
        // D-10 / Rule-3 fix: the next/font variable classes must also be present
        // on the document element, not only on <body>. --store-font-sans and
        // --store-font-display are declared by [data-theme="..."], which
        // matches <html>; their nested var(--font-geist-sans) (etc.) reference
        // is resolved once at the element that DECLARES the custom property,
        // not lazily at the element that later consumes it in font-family. If
        // the referenced next/font variable isn't also in scope at <html>, the
        // token resolves to invalid there and that invalidity is what
        // inherits down to <body> — the font-family declaration on body alone
        // is not sufficient. Confirmed by a standalone minimal repro outside
        // this app before applying here.
        className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} ${orbitron.variable} ${fraunces.variable} ${nunito.variable}`}
        suppressHydrationWarning
      >
        <head>
          {/* MCP discovery links complement the metadata emitted by generateMetadata. */}
          <link rel="mcp-server" href="/api/mcp" type="application/json" />
          <link rel="mcp-schema" href="/api/mcp/schema" type="application/json" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} ${orbitron.variable} ${fraunces.variable} ${nunito.variable} antialiased flex flex-col min-h-screen bg-surface text-foreground`}
          suppressHydrationWarning
        >
          <StoreConfigProvider config={toPublicStoreConfig(config)} themeTokens={themeTokens}>
          <SubscriptionSetupReturnHandler />
          {/* Promotional banner - shown above header when enabled */}
          <Suspense fallback={null}>
            <PromotionalBanner />
          </Suspense>

          {/* Global navigation header with suspense boundary */}
          <Suspense fallback={<div className="h-16 bg-surface-elevated" />}>
            <Header />
          </Suspense>

          {/* The root owns the storefront's single main landmark. */}
          <main className="flex-1" suppressHydrationWarning>
            {children}
          </main>

          {/* Global footer */}
          <Footer />

          {/* Global toast notification system (storefront only; admin mounts its own) */}
          <StorefrontToaster />
          
          {/* Core Web Vitals monitoring */}
          <WebVitals />
          </StoreConfigProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
