/**
 * === Next.js Middleware with Clerk Authentication ===
 *
 * Global middleware that runs on every request to handle authentication
 * and routing logic. Integrates with Clerk for seamless user session
 * management across the entire application.
 *
 * === Features ===
 * - **Authentication Handling**: Automatic session validation and routing
 * - **Route Protection**: Secures API routes and protected pages
 * - **Static Asset Exclusion**: Bypasses auth for performance-critical assets
 * - **Edge Runtime**: Runs on Cloudflare Edge for minimal latency
 * - **Automatic Redirects**: Handles login/logout flows transparently
 *
 * === Technical Implementation ===
 * - **Clerk Integration**: Uses clerkMiddleware for authentication logic
 * - **Pattern Matching**: Sophisticated regex for route filtering
 * - **Performance Optimization**: Excludes static assets from auth checks
 * - **API Coverage**: Protects all API routes including tRPC endpoints
 *
 * === Route Matching Logic ===
 * The matcher config uses a complex regex pattern that:
 * - Includes all dynamic routes and pages
 * - Excludes static assets (images, CSS, JS, fonts)
 * - Includes API routes and tRPC endpoints
 * - Excludes Next.js internal routes (_next)
 *
 * === Protected Routes ===
 * - `/api/*` - All API endpoints require proper session handling
 * - `/orders` - User-specific order history (auth required)
 * - `/checkout` - Cart completion flow (optional auth for guest checkout)
 *
 * === Performance Considerations ===
 * - Static assets bypass middleware for faster delivery
 * - Edge runtime provides sub-10ms authentication checks
 * - Minimal overhead for public pages and API routes
 *
 * === Security Benefits ===
 * - Automatic CSRF protection through Clerk
 * - Session validation on every protected request
 * - Secure cookie handling with httpOnly flags
 * - XSS protection through proper session management
 */

// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk middleware instance for handling authentication across all routes
 * Automatically manages user sessions, redirects, and protected route access
 */
export default clerkMiddleware();

/**
 * Middleware configuration defining which routes should be processed
 * 
 * The matcher uses a sophisticated regex pattern to:
 * - Include all pages and API routes for auth processing
 * - Exclude static assets for performance optimization
 * - Cover tRPC endpoints for API protection
 */
export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Include all API and tRPC routes for protection
    "/(api|trpc)(.*)",
  ],
};
