/**
 * === Admin Route Guard Component ===
 *
 * Protects admin routes by ensuring only authenticated users with admin
 * privileges can access admin pages. Provides fallback UI for unauthorized access.
 *
 * === Features ===
 * - **Client-side Protection**: Guards admin routes in the browser
 * - **Clerk Integration**: Uses Clerk authentication state
 * - **Role-based Access**: Checks for admin role or whitelisted user IDs
 * - **Loading States**: Shows loading while checking authentication
 * - **Error Handling**: Graceful fallback for unauthorized users
 * - **Development Mode**: More permissive in development environment
 *
 * === Usage ===
 * ```tsx
 * export default function AdminPage() {
 *   return (
 *     <AdminGuard>
 *       <AdminDashboard />
 *     </AdminGuard>
 *   );
 * }
 * ```
 *
 * === Security Notes ===
 * - This is client-side protection only
 * - Server-side API protection is still required
 * - In development, any authenticated user gets admin access
 * - In production, only users with admin role or in ADMIN_USER_IDS
 */

"use client";

import { useUser, useAuth, SignInButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, LogIn, Loader2 } from "lucide-react";

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requirePermissions?: string[];
}

export default function AdminGuard({ 
  children, 
  fallback, 
  requirePermissions = [] 
}: AdminGuardProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>("");

  useEffect(() => {
    async function checkAdminAccess() {
      if (!userLoaded || !authLoaded) return;

      try {
        // Not signed in
        if (!isSignedIn || !user) {
          setIsAuthorized(false);
          setAuthError("Authentication required");
          return;
        }

        // Development mode - allow any authenticated user
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ DEV MODE: User ${user.id} granted admin access`);
          setIsAuthorized(true);
          return;
        }

        // Production mode - check admin role via server-side API call
        // We can't use environment variables on client side for security,
        // so we make an API call to check admin status
        const response = await fetch('/api/admin/auth-check', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const result = await response.json() as { success: boolean; error?: string };
          if (result.success) {
            setIsAuthorized(true);
            return;
          }
        }

        setIsAuthorized(false);
        setAuthError("Admin access required. Contact administrator to request access.");

      } catch (error) {
        console.error("Admin auth check failed:", error);
        setIsAuthorized(false);
        setAuthError("Authentication error. Please try again.");
      }
    }

    checkAdminAccess();
  }, [userLoaded, authLoaded, isSignedIn, user]);

  // Loading state
  if (!userLoaded || !authLoaded || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="bg-neutral-800 border-neutral-700 p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Checking Access Permissions
          </h2>
          <p className="text-gray-400">
            Verifying your admin credentials...
          </p>
        </Card>
      </div>
    );
  }

  // Not authorized
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="bg-neutral-800 border-neutral-700 p-8 text-center max-w-md">
          <div className="flex items-center justify-center mb-4">
            {!isSignedIn ? (
              <LogIn className="w-12 h-12 text-blue-500" />
            ) : (
              <Shield className="w-12 h-12 text-red-500" />
            )}
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-4">
            {!isSignedIn ? "Sign In Required" : "Access Denied"}
          </h2>
          
          <p className="text-gray-400 mb-6">
            {authError}
          </p>

          {!isSignedIn ? (
            <SignInButton mode="modal">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Continue
              </Button>
            </SignInButton>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-yellow-300 text-sm">
                  You don&rsquo;t have admin privileges for this application.
                  Please contact the system administrator to request access.
                </p>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                className="border-neutral-600 text-gray-300 hover:bg-neutral-700"
              >
                Return to Home
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Authorized - render children
  return <>{children}</>;
}

/**
 * Hook to check if current user has admin access
 */
export function useAdminAccess() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAccess() {
      if (!userLoaded || !authLoaded) return;

      if (!isSignedIn || !user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        // Development mode - allow any authenticated user
        if (process.env.NODE_ENV === "development") {
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }

        // Production mode - check admin role via server-side API call
        const response = await fetch('/api/admin/auth-check', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const result = await response.json() as { success: boolean; error?: string };
          setIsAdmin(result.success);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Admin auth check failed:", error);
        setIsAdmin(false);
      }
      
      setIsLoading(false);
    }

    checkAdminAccess();
  }, [userLoaded, authLoaded, isSignedIn, user]);

  return { isAdmin, isLoading };
}
