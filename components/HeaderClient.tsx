/**
 * === Header Client Component ===
 *
 * Client-side header component that provides the main navigation interface with
 * interactive elements including category navigation, user authentication,
 * shopping cart, and AI assistant access.
 *
 * === Features ===
 * - **Responsive Navigation**: Adapts to different screen sizes
 * - **Category Dropdown**: Dynamic category navigation from server data
 * - **User Authentication**: Clerk integration for login/logout
 * - **Shopping Cart**: Quick access to cart with item count
 * - **AI Assistant**: Integrated Volt AI chat drawer
 * - **Interactive Elements**: Hover effects and smooth transitions
 *
 * === Components Integrated ===
 * - **AgentDrawer**: AI-powered shopping assistant
 * - **ClerkLogin**: User authentication and profile management
 * - **CartDrawer**: Shopping cart review and management
 * - **DropdownMenu**: Category navigation menu
 *
 * === Navigation Structure ===
 * ```
 * Logo | Home | Categories ↓ | Help & Search | Cart | Login
 * ```
 *
 * === Usage ===
 * ```tsx
 * <HeaderClient categories={categoryData} />
 * ```
 *
 * === Props ===
 * @param categories - Array of category objects for navigation dropdown
 *
 * === Styling ===
 * - Dark theme with orange accent colors
 * - Responsive layout with flexbox
 * - Consistent hover states and transitions
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Home, Search, LogIn, ChevronDown, ShoppingCart, Menu, X } from "lucide-react";
import AgentDrawer from "@/components/agent/AgentDrawer";
import ClerkLogin from "@/components/login/ClerkLogin";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import CartDrawer from "@/components/cart/CartDrawer";
import { CartHydrationGuard } from "@/components/cart/CartHydrationGuard";
import ClientOnly from "@/components/ClientOnly";

/**
 * Props interface for HeaderClient component
 */
interface HeaderClientProps {
  categories: { id: number; name: string; slug: string }[];
}

/**
 * HeaderClient component providing main navigation with interactive elements
 * 
 * @param categories - Array of product categories for navigation dropdown
 * @returns JSX element representing the main site header
 */
export default function HeaderClient({
  categories,
}: HeaderClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex justify-between items-center px-4 sm:px-6 py-4 bg-black text-white">
      <Link href="/" className="text-lg sm:text-xl font-bold">
        Voltique
      </Link>

      {/* Desktop Navigation */}
      <div className="hidden md:flex gap-2 sm:gap-4 items-center">
        <Link 
          href="/"
          prefetch={true}
          className="flex items-center gap-2 px-4 py-2 text-white hover:bg-white hover:text-orange-500 rounded-md transition-colors"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500"
            >
              Categories <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white text-black">
            {categories.map((category) => (
              <DropdownMenuItem
                className="hover:text-orange-500 hover:border-l-2 border-orange-500 pl-4"
                key={category.id}
                asChild
              >
                <Link 
                  href={`/category/${category.slug}`} 
                  className="w-full"
                  prefetch={true}
                >
                  {category.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ClientOnly>
          <AgentDrawer />
        </ClientOnly>
        <ClerkLogin />
        <CartDrawer />
      </div>

      {/* Mobile Navigation */}
      <div className="flex md:hidden gap-2 items-center">
        <CartDrawer />
        
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-black text-white w-full max-w-sm">
            {/* Accessibility components */}
            <VisuallyHidden>
              <SheetTitle>Mobile Navigation Menu</SheetTitle>
              <SheetDescription>
                Main navigation menu for mobile devices with links to home, categories, help, and user account.
              </SheetDescription>
            </VisuallyHidden>

            <div className="flex flex-col space-y-4 mt-8">
              <Link 
                href="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 text-white hover:text-orange-500 py-3 px-4 rounded-lg hover:bg-neutral-800"
                prefetch={true}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Link>

              <div className="px-4 py-2">
                <h3 className="text-orange-500 font-semibold mb-2">Categories</h3>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/category/${category.slug}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block text-white hover:text-orange-500 py-2 px-2 rounded hover:bg-neutral-800"
                      prefetch={true}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="px-4 border-t border-neutral-700 pt-4 space-y-3">
                <button 
                  className="flex items-center space-x-3 text-white hover:text-orange-500 py-3 px-4 rounded-lg hover:bg-neutral-800 w-full text-left"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    // Force open the agent drawer
                    const agentButton = document.querySelector('[data-testid="agent-drawer-trigger"]') as HTMLElement;
                    if (agentButton) {
                      agentButton.click();
                    }
                  }}
                >
                  <Search className="h-5 w-5" />
                  <span>Help & Search</span>
                </button>
                <div onClick={() => setIsMobileMenuOpen(false)}>
                  <ClerkLogin />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
