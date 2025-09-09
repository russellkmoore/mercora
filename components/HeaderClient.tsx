/**
 * === Header Client Component ===
 *
 * Client-side header component that provides the main navigation interface with
 * interactive elements including hierarchical category navigation, user authentication,
 * shopping cart, and AI assistant access.
 *
 * === Features ===
 * - **Responsive Navigation**: Adapts to different screen sizes
 * - **Hierarchical Categories**: Nested category navigation with proper indentation
 * - **Expandable Categories**: Mobile menu with expand/collapse functionality
 * - **User Authentication**: Clerk integration for login/logout
 * - **Shopping Cart**: Quick access to cart with item count
 * - **AI Assistant**: Integrated Volt AI chat drawer
 * - **Interactive Elements**: Hover effects and smooth transitions
 *
 * === Category Navigation ===
 * - **Desktop Dropdown**: Hierarchical menu with visual indentation using tree symbols
 * - **Mobile Menu**: Expandable tree structure with chevron expand/collapse icons
 * - **Visual Hierarchy**: Different indentation levels and styling for nested categories
 * - **Parent Category Detection**: Bold styling for categories with children
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
import { Home, Search, LogIn, ChevronDown, ChevronRight, ShoppingCart, Menu, X, Grid3X3 } from "lucide-react";
import AgentDrawer from "@/components/agent/AgentDrawer";
import ClerkLogin from "@/components/login/ClerkLogin";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import CartDrawer from "@/components/cart/CartDrawer";
import { CartHydrationGuard } from "@/components/cart/CartHydrationGuard";
import ClientOnly from "@/components/ClientOnly";
import type { MACHCategory } from '@/lib/types/mach';

/**
 * Props interface for HeaderClient component
 */
interface HeaderClientProps {
  categories: MACHCategory[];
}

/**
 * Helper function to build hierarchical category structure from flat array
 * 
 * @param categories - Flat array of categories
 * @param parentId - Parent ID to filter by (null for root categories)
 * @returns Array of categories with the specified parent
 */
const buildCategoryTree = (categories: MACHCategory[], parentId: string | null = null): MACHCategory[] => {
  return categories.filter(cat => {
    // Handle both null and undefined values for root categories
    if (parentId === null) {
      return cat.parent_id === null || cat.parent_id === undefined;
    }
    return cat.parent_id === parentId;
  });
};

/**
 * Helper function to check if a category has children
 * 
 * @param categoryId - Category ID to check
 * @param allCategories - All categories to search through
 * @returns Boolean indicating if category has children
 */
const hasChildren = (categoryId: string, allCategories: MACHCategory[]): boolean => {
  return allCategories.some(cat => cat.parent_id === categoryId);
};

/**
 * Helper function to get category display name
 * 
 * @param category - Category object
 * @returns String representation of category name
 */
const getCategoryName = (category: MACHCategory): string => {
  return typeof category.name === 'string' ? category.name : category.name?.en || Object.values(category.name || {})[0] || '';
};

/**
 * Helper function to get category slug for URL
 * 
 * @param category - Category object
 * @returns String representation of category slug
 */
const getCategorySlug = (category: MACHCategory): string => {
  return typeof category.slug === 'string' ? category.slug : (category.slug?.en || Object.values(category.slug || {})[0] || category.id);
};

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Toggle category expansion in mobile menu
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Get root categories (those without a parent)
  const rootCategories = buildCategoryTree(categories, null);

  /**
   * Recursive component to render category tree for desktop dropdown
   */
  const CategoryDropdownTree = ({ cats, level = 0 }: { cats: MACHCategory[], level?: number }) => (
    <>
      {cats.map((category) => {
        const children = buildCategoryTree(categories, category.id);
        const hasChildCategories = children.length > 0;
        
        return (
          <div key={category.id}>
            <DropdownMenuItem
              className="hover:text-orange-500 p-0"
              asChild
            >
              <Link 
                href={`/category/${getCategorySlug(category)}`} 
                className="w-full flex items-center px-4 py-2"
                prefetch={true}
                style={{ paddingLeft: `${level * 8}px` }}
              >
                <span className={`flex items-center ${hasChildCategories ? 'font-semibold' : ''}`}>
                  {level > 0 && <span className="mr-2 text-gray-400">└</span>}
                  {getCategoryName(category)}
                </span>
              </Link>
            </DropdownMenuItem>
            {hasChildCategories && (
              <CategoryDropdownTree cats={children} level={level + 1} />
            )}
          </div>
        );
      })}
    </>
  );

  /**
   * Get indentation class for nested categories based on level
   */
  const getIndentationClass = (level: number): string => {
    const indentationClasses = {
      0: '',
      1: 'ml-6 border-l border-neutral-700 pl-4',
      2: 'ml-12 border-l border-neutral-700 pl-4', 
      3: 'ml-16 border-l border-neutral-700 pl-4'
    };
    return indentationClasses[level as keyof typeof indentationClasses] || 'ml-20 border-l border-neutral-700 pl-4';
  };

  /**
   * Simplified mobile category list with flat structure and visual grouping
   */
  const SimpleMobileCategoryList = ({ 
    categories, 
    onCategorySelect 
  }: { 
    categories: MACHCategory[], 
    onCategorySelect: () => void 
  }) => {
    // Group categories by parent for better visual organization
    const parentCategories = categories.filter(cat => !cat.parent_id);
    const childCategories = categories.filter(cat => cat.parent_id);
    
    // Create parent -> children mapping
    const categoryGroups = parentCategories.map(parent => ({
      parent,
      children: childCategories.filter(child => child.parent_id === parent.id)
    }));

    return (
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {/* Featured/Top Level Categories */}
        {categoryGroups.slice(0, 6).map(group => (
          <div key={group.parent.id} className="mb-4">
            {/* Parent Category - Prominent Display */}
            <Link
              href={`/category/${getCategorySlug(group.parent)}`}
              onClick={onCategorySelect}
              className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-orange-600/20 to-orange-500/10 rounded-lg border border-orange-500/30 hover:border-orange-400 transition-all duration-200 group"
              prefetch={true}
            >
              <div>
                <div className="text-white font-semibold text-base group-hover:text-orange-300 transition-colors">
                  {getCategoryName(group.parent)}
                </div>
                {group.children.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {group.children.length} subcategories
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-orange-400 group-hover:text-orange-300 transition-colors" />
            </Link>
            
            {/* Child Categories - Compact Grid */}
            {group.children.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2 pl-4">
                {group.children.slice(0, 4).map(child => (
                  <Link
                    key={child.id}
                    href={`/category/${getCategorySlug(child)}`}
                    onClick={onCategorySelect}
                    className="text-sm text-gray-300 hover:text-orange-400 py-2 px-3 rounded-md hover:bg-neutral-800/50 transition-all duration-200 truncate"
                    prefetch={true}
                  >
                    {getCategoryName(child)}
                  </Link>
                ))}
                {group.children.length > 4 && (
                  <Link
                    href={`/category/${getCategorySlug(group.parent)}`}
                    onClick={onCategorySelect}
                    className="text-xs text-orange-500 hover:text-orange-400 py-2 px-3 rounded-md hover:bg-neutral-800/50 transition-all duration-200 col-span-2 text-center border border-orange-500/20 hover:border-orange-400/40"
                    prefetch={true}
                  >
                    View all {group.children.length} items →
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
        
        {/* Additional categories if any */}
        {categoryGroups.length > 6 && (
          <div className="border-t border-neutral-700 pt-4 mt-6">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">More Categories</div>
            <div className="grid grid-cols-2 gap-2">
              {categoryGroups.slice(6).map(group => (
                <Link
                  key={group.parent.id}
                  href={`/category/${getCategorySlug(group.parent)}`}
                  onClick={onCategorySelect}
                  className="text-sm text-gray-300 hover:text-orange-400 py-3 px-4 rounded-md hover:bg-neutral-800/50 transition-all duration-200 truncate text-center border border-neutral-700 hover:border-orange-500/30"
                  prefetch={true}
                >
                  {getCategoryName(group.parent)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Recursive component to render category tree for mobile menu (LEGACY - keeping for fallback)
   */
  const CategoryMobileTree = ({ cats, level = 0 }: { cats: MACHCategory[], level?: number }) => (
    <>
      {cats.map((category) => {
        const children = buildCategoryTree(categories, category.id);
        const hasChildCategories = children.length > 0;
        const isExpanded = expandedCategories.has(category.id);
        
        return (
          <div key={category.id} className={getIndentationClass(level)}>
            <div className="flex items-center">
              {hasChildCategories ? (
                <button
                  onClick={() => toggleCategoryExpansion(category.id)}
                  className="mr-2 p-3 text-gray-400 hover:text-white flex-shrink-0 min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-8 h-6 mr-2 flex-shrink-0" /> // Spacer for alignment
              )}
              <Link
                href={`/category/${getCategorySlug(category)}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-white hover:text-orange-500 py-2 px-2 rounded hover:bg-neutral-800 flex-1 ${hasChildCategories ? 'font-semibold' : ''}`}
                prefetch={true}
              >
                {getCategoryName(category)}
              </Link>
            </div>
            {hasChildCategories && isExpanded && (
              <div className="mt-2">
                <CategoryMobileTree cats={children} level={level + 1} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );

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
              <Grid3X3 className="mr-2 h-4 w-4" />
              Categories <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white text-black max-h-96 overflow-y-auto">
            {rootCategories.length > 0 ? (
              <CategoryDropdownTree cats={rootCategories} />
            ) : (
              // Fallback: show all categories if no root categories found
              categories.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  className="hover:text-orange-500 hover:border-l-2 border-orange-500 p-0"
                  asChild
                >
                  <Link 
                    href={`/category/${getCategorySlug(category)}`} 
                    className="w-full flex items-center px-4 py-2"
                    prefetch={true}
                  >
                    <span className="flex items-center">
                      {getCategoryName(category)}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
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
          <SheetContent side="right" className="bg-black text-white w-full max-w-sm overflow-y-auto">
            {/* Accessibility components */}
            <VisuallyHidden>
              <SheetTitle>Mobile Navigation Menu</SheetTitle>
              <SheetDescription>
                Main navigation menu for mobile devices with links to home, categories, help, and user account.
              </SheetDescription>
            </VisuallyHidden>

            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-700">
              <div>
                <h2 className="text-xl font-bold text-white">Menu</h2>
                <p className="text-sm text-gray-400">Browse our outdoor gear</p>
              </div>
              <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Grid3X3 className="w-4 h-4 text-orange-400" />
              </div>
            </div>

            <div className="space-y-6">
              <Link 
                href="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center space-x-3 text-white hover:text-orange-500 py-3 px-4 rounded-lg hover:bg-neutral-800"
                prefetch={true}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Link>

              <div>
                <SimpleMobileCategoryList categories={categories} onCategorySelect={() => setIsMobileMenuOpen(false)} />
              </div>

              <div className="border-t border-neutral-700 pt-6 space-y-3">
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
