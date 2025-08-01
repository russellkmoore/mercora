"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { Package } from "lucide-react";
import ClientOnly from "@/components/ClientOnly";

export default function ClerkLogin() {
  return (
    <ClientOnly fallback={
      <Button
        variant="ghost"
        className="text-white hover:bg-white hover:text-orange-500"
        disabled
      >
        <LogIn className="mr-2 h-4 w-4" /> Loading...
      </Button>
    }>
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
              label="View Voltique Order History"
              labelIcon={<Package />}
              href="/orders"
            />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
    </ClientOnly>
  );
}
