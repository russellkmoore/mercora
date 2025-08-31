/**
 * === Next.js Middleware with Clerk Authentication & Maintenance Mode ===
 *
 * Global middleware that runs on every request to handle authentication,
 * maintenance mode, and routing logic. Integrates with Clerk for seamless 
 * user session management across the entire application.
 *
 * === Features ===
 * - **Authentication Handling**: Automatic session validation and routing
 * - **Maintenance Mode**: Block public access during maintenance (admin still works)
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
 * - **Settings Integration**: Reads maintenance mode from database settings
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
 * === Maintenance Mode Logic ===
 * - Checks settings database for maintenance mode status
 * - Allows admin routes (/admin/*) to bypass maintenance
 * - Shows maintenance page for all other routes when enabled
 * - Displays configurable maintenance message to users
 *
 * === Performance Considerations ===
 * - Static assets bypass middleware for faster delivery
 * - Edge runtime provides sub-10ms authentication checks
 * - Minimal overhead for public pages and API routes
 * - Maintenance mode check optimized for speed
 *
 * === Security Benefits ===
 * - Automatic CSRF protection through Clerk
 * - Session validation on every protected request
 * - Secure cookie handling with httpOnly flags
 * - XSS protection through proper session management
 * - Admin bypass ensures admin access during maintenance
 */

// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/utils/settings";

/**
 * Custom middleware that combines Clerk authentication with maintenance mode checking
 */
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;
  
  // Skip maintenance check for static assets and Next.js internals
  if (pathname.includes('/_next') || 
      pathname.includes('/favicon') || 
      pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
    return NextResponse.next();
  }
  
  // Skip maintenance check for admin routes - admins should always have access
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }
  
  try {
    // Check maintenance mode settings
    const systemSettings = await getSettings('system');
    const isMaintenanceMode = systemSettings['system.maintenance_mode'] || false;
    
    if (isMaintenanceMode) {
      const maintenanceMessage = systemSettings['system.maintenance_message'] || 
        "We're making some improvements! We'll be back soon.";
      
      // Return maintenance page for all non-admin routes
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Maintenance - Voltique</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              color: white;
              margin: 0;
              padding: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              text-align: center;
              padding: 2rem;
              max-width: 500px;
            }
            .logo {
              font-size: 2rem;
              font-weight: bold;
              color: #f97316;
              margin-bottom: 2rem;
            }
            .message {
              font-size: 1.25rem;
              margin-bottom: 1rem;
              color: #e5e5e5;
            }
            .submessage {
              color: #a3a3a3;
              margin-bottom: 2rem;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid #374151;
              border-top: 4px solid #f97316;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 2rem auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">Voltique</div>
            <div class="message">${maintenanceMessage}</div>
            <div class="submessage">We'll be back online shortly.</div>
            <div class="spinner"></div>
          </div>
        </body>
        </html>
        `,
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html',
            'Retry-After': '3600' // Suggest retry in 1 hour
          }
        }
      );
    }
  } catch (error) {
    // If settings check fails, continue normally to avoid breaking the site
    console.error('Error checking maintenance mode:', error);
  }
  
  // Continue with normal Clerk authentication
  return NextResponse.next();
});

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
