"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LogIn, Package, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useAdminAccess } from "@/components/admin/AdminGuard";

export default function ClerkLogin() {
  const [hasMounted, setHasMounted] = useState(false);
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();
  

  useEffect(() => {
    // Small delay to ensure Clerk is fully initialized
    const timer = setTimeout(() => {
      setHasMounted(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);


  // Don't render anything until client has mounted
  if (!hasMounted) {
    return (
      <Button
        variant="ghost"
        className="text-white hover:bg-white hover:text-orange-500"
        disabled
      >
        <LogIn className="mr-2 h-4 w-4" /> Loading...
      </Button>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button
            variant="ghost"
            className="text-white hover:bg-white hover:text-orange-500"
          >
            <LogIn className="mr-2 h-4 w-4" /> Sign In / Register
          </Button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }}>
          <UserButton.MenuItems>
            <UserButton.Link
              label="View Order History"
              labelIcon={<Package />}
              href="/orders"
            />
            {!adminLoading && isAdmin && (
              <UserButton.Link
                label="Admin Dashboard"
                labelIcon={<Shield />}
                href="/admin"
              />
            )}
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
    </>
  );
}
