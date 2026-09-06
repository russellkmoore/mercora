"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

/**
 * Storefront toast overlay, mounted from the root layout.
 *
 * The admin layout mounts its own `Toaster` (top-right, neutral palette).
 * Both layouts share the root, so without this guard every admin toast
 * rendered twice — once in each overlay. Admin routes return null here and
 * keep their own styling; the storefront keeps the themed, top-centre one.
 */
export function StorefrontToaster() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;

  return (
    <Toaster
      position="top-center"
      toastOptions={{
        className:
          "bg-primary/80 text-on-primary font-semibold rounded-md mt-[60px] shadow-lg animate-in fade-in slide-in-from-top-5",
        duration: 3000,
      }}
    />
  );
}
