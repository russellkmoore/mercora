"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from URL if no items provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
    const nonLinkableSegments = new Set(["category", "product"]);

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      
      // Format segment for display
      let label = segment;
      if (segment === 'category') {
        label = 'Categories';
      } else if (segment === 'product') {
        label = 'Product';
      } else if (segment === 'checkout') {
        label = 'Checkout';
      } else if (segment === 'orders') {
        label = 'My Orders';
      } else {
        // Capitalize and replace hyphens
        label = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      breadcrumbs.push({
        label,
        href: !isLast && !nonLinkableSegments.has(segment) ? currentPath : undefined,
        current: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();
  
  // Don't show breadcrumbs on homepage
  if (pathname === '/' || breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav 
      className={`flex items-center space-x-2 text-sm text-gray-400 bg-neutral-900/50 px-4 py-3 border-b border-neutral-800 ${className}`}
      aria-label="Breadcrumb navigation"
    >
      {breadcrumbItems.map((item, index) => {
        const key = item.href ?? `${item.label}-${index}`;
        const linkHref = item.href;

        return (
          <div key={key} className="flex items-center space-x-2">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
            {index === 0 ? (
              <Link
                href={linkHref ?? "/"}
                className="flex items-center hover:text-orange-400 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">{item.label}</span>
              </Link>
            ) : item.current ? (
              <span className="text-white font-medium truncate max-w-[150px] sm:max-w-none">
                {item.label}
              </span>
            ) : linkHref ? (
              <Link
                href={linkHref}
                className="hover:text-orange-400 transition-colors truncate max-w-[100px] sm:max-w-none"
              >
                {item.label}
              </Link>
            ) : (
              <span className="truncate max-w-[100px] sm:max-w-none text-gray-300">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
