/**
 * === Admin Layout Provider ===
 *
 * Context provider for admin layout state management including
 * sidebar visibility, breadcrumbs, and admin-specific settings.
 *
 * === Features ===
 * - **Sidebar State**: Toggle sidebar collapsed/expanded state
 * - **Breadcrumbs**: Dynamic breadcrumb generation based on route
 * - **Page Titles**: Automatic page title detection
 * - **Local Storage**: Persist sidebar preferences
 * - **Responsive**: Handle mobile sidebar behavior
 *
 * === State ===
 * - sidebarCollapsed: boolean for sidebar visibility
 * - breadcrumbs: array of breadcrumb items
 * - pageTitle: current page title
 *
 * === Usage ===
 * Wrap admin layout content to provide admin state context
 */

"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

interface AdminLayoutContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  breadcrumbs: BreadcrumbItem[];
  pageTitle: string;
  isMobile: boolean;
}

const AdminLayoutContext = createContext<AdminLayoutContextType | undefined>(undefined);

/**
 * Hook to use admin layout context
 */
export function useAdminLayout() {
  const context = useContext(AdminLayoutContext);
  if (context === undefined) {
    throw new Error("useAdminLayout must be used within an AdminLayoutProvider");
  }
  return context;
}

/**
 * Generate breadcrumbs based on current pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  // Always start with Admin
  breadcrumbs.push({
    label: 'Admin',
    href: '/admin',
    current: pathname === '/admin'
  });

  // Map path segments to breadcrumbs
  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    // Skip the 'admin' segment since it's already added
    if (segment === 'admin') continue;
    
    // Generate readable labels
    let label = segment.charAt(0).toUpperCase() + segment.slice(1);
    
    // Handle special cases
    switch (segment) {
      case 'products':
        label = 'Products';
        break;
      case 'categories':
        label = 'Categories';
        break;
      case 'promotions':
        label = 'Promotions';
        break;
      case 'knowledge':
        label = 'Knowledge Base';
        break;
      default:
        // Handle IDs and special segments
        if (segment.match(/^[0-9a-f-]+$/)) {
          // If it looks like an ID, use the previous segment + "Detail"
          const prevSegment = segments[i - 1];
          if (prevSegment) {
            label = prevSegment.charAt(0).toUpperCase() + prevSegment.slice(0, -1) + ' Detail';
          }
        }
    }
    
    breadcrumbs.push({
      label,
      href: currentPath,
      current: i === segments.length - 1
    });
  }

  return breadcrumbs;
}

/**
 * Generate page title based on current pathname
 */
function generatePageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  
  if (pathname === '/admin') {
    return 'Dashboard';
  }
  
  const lastSegment = segments[segments.length - 1];
  
  // Handle special cases
  switch (lastSegment) {
    case 'products':
      return 'Product Management';
    case 'categories':
      return 'Category Management';
    case 'promotions':
      return 'Promotion Management';
    case 'knowledge':
      return 'Knowledge Base';
    default:
      // Handle IDs and other segments
      if (lastSegment?.match(/^[0-9a-f-]+$/)) {
        const prevSegment = segments[segments.length - 2];
        if (prevSegment) {
          return prevSegment.charAt(0).toUpperCase() + prevSegment.slice(0, -1) + ' Detail';
        }
      }
      return lastSegment?.charAt(0).toUpperCase() + lastSegment?.slice(1) || 'Admin';
  }
}

interface AdminLayoutProviderProps {
  children: ReactNode;
}

/**
 * Admin Layout Provider component
 */
export default function AdminLayoutProvider({ children }: AdminLayoutProviderProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-collapse sidebar on mobile
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    // Set initial state
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load sidebar preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    if (saved !== null && !isMobile) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, [isMobile]);

  // Save sidebar preference to localStorage
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isMobile]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const breadcrumbs = generateBreadcrumbs(pathname);
  const pageTitle = generatePageTitle(pathname);

  const value: AdminLayoutContextType = {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    breadcrumbs,
    pageTitle,
    isMobile,
  };

  return (
    <AdminLayoutContext.Provider value={value}>
      {children}
    </AdminLayoutContext.Provider>
  );
}