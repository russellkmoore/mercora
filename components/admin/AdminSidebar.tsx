/**
 * === Admin Sidebar Component ===
 *
 * Navigation sidebar for the admin interface with collapsible design
 * and active state management. Provides quick access to all admin sections.
 *
 * === Features ===
 * - **Collapsible Design**: Toggle between full and icon-only views
 * - **Active States**: Highlight current page in navigation
 * - **Responsive**: Mobile-friendly with overlay behavior
 * - **Professional Styling**: Admin-optimized design and colors
 * - **Route Integration**: Next.js Link integration with prefetching
 *
 * === Navigation Items ===
 * - Dashboard: Admin overview and metrics
 * - Products: Product catalog management
 * - Categories: Category hierarchy management
 * - Promotions: Discount and promotion management
 * - Knowledge Base: Help articles and documentation
 * - Settings: Future admin configuration
 *
 * === Usage ===
 * Used within AdminLayout to provide persistent navigation
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminLayout } from "./AdminLayoutProvider";
import {
  BarChart3,
  Package,
  FolderOpen,
  Percent,
  FileText,
  Settings,
  ChevronLeft,
  Menu,
  X,
  ClipboardList,
  FileEdit
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: BarChart3,
    description: "Overview and analytics"
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package,
    description: "Product catalog management"
  },
  {
    label: "Categories",
    href: "/admin/categories",
    icon: FolderOpen,
    description: "Category organization"
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ClipboardList,
    description: "Order management"
  },
  {
    label: "Promotions",
    href: "/admin/promotions",
    icon: Percent,
    description: "Discounts and campaigns"
  },
  {
    label: "Pages",
    href: "/admin/pages",
    icon: FileEdit,
    description: "Content pages and CMS"
  },
  {
    label: "Knowledge",
    href: "/admin/knowledge",
    icon: FileText,
    description: "Help articles and docs"
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Admin configuration"
  },
];

/**
 * Admin Sidebar Component
 */
export default function AdminSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, isMobile } = useAdminLayout();

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative top-0 left-0 h-screen bg-neutral-900 border-r border-neutral-700 z-50
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
        ${isMobile && sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}
      `}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <div>
                <h1 className="text-white font-semibold text-lg">Voltique</h1>
                <p className="text-gray-400 text-xs">Admin Panel</p>
              </div>
            </div>
          )}
          
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-white p-2"
          >
            {isMobile ? (
              sidebarCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />
            ) : (
              <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            )}
          </Button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors
                  ${active 
                    ? 'bg-orange-600 text-white' 
                    : 'text-gray-300 hover:text-white hover:bg-neutral-800'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon className={`w-5 h-5 ${sidebarCollapsed ? '' : 'flex-shrink-0'}`} />
                
                {!sidebarCollapsed && (
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-neutral-700">
            <div className="text-xs text-gray-500">
              <div className="mb-1">Voltique Admin v1.0</div>
              <div>Powered by MACH Alliance</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}