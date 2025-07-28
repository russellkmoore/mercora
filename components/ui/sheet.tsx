/**
 * === Sheet Component (shadcn/ui) ===
 *
 * A slide-out dialog component built with Radix UI Dialog primitives.
 * Provides a flexible overlay panel that slides in from any edge of the screen,
 * commonly used for navigation menus, settings panels, or detailed content views.
 *
 * === Features ===
 * - **Multi-directional**: Slides from top, right, bottom, or left
 * - **Accessible**: Full keyboard navigation and screen reader support
 * - **Animated**: Smooth slide and fade animations
 * - **Portal Rendering**: Renders outside normal DOM flow for proper layering
 * - **Focus Management**: Traps focus within sheet when open
 * - **Backdrop**: Semi-transparent overlay with click-to-close
 * - **Customizable**: Flexible styling and content composition
 *
 * === Slide Directions ===
 * - **right**: Default slide from right edge (drawer style)
 * - **left**: Slide from left edge (navigation menu style)
 * - **top**: Slide from top edge (notifications/alerts)
 * - **bottom**: Slide from bottom edge (mobile actions/menus)
 *
 * === Usage ===
 * ```tsx
 * <Sheet>
 *   <SheetTrigger>Open Sheet</SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Settings</SheetTitle>
 *       <SheetDescription>Configure your preferences</SheetDescription>
 *     </SheetHeader>
 *     <div className="py-4">Sheet content here</div>
 *   </SheetContent>
 * </Sheet>
 * ```
 *
 * === Accessibility ===
 * - ARIA dialog implementation
 * - Focus trap when open
 * - Escape key to close
 * - Screen reader announcements
 * - Proper heading hierarchy
 */

"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * === Sheet Root Component ===
 * 
 * Main container for the sheet dialog. Manages open/close state
 * and provides context for all child components.
 * 
 * @param children - Sheet trigger and content components
 * @param ...props - All Radix Dialog Root props (open, onOpenChange, etc.)
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

/**
 * === Sheet Trigger Component ===
 * 
 * Button or element that opens the sheet when clicked.
 * Can be any clickable element or component.
 * 
 * @param children - Trigger content (button text, icon, etc.)
 * @param ...props - All Radix Dialog Trigger props
 */
function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

/**
 * === Sheet Close Component ===
 * 
 * Button that closes the sheet. Can be placed anywhere within
 * the sheet content for programmatic closing.
 * 
 * @param children - Close button content
 * @param ...props - All Radix Dialog Close props
 */
function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

/**
 * === Sheet Portal Component ===
 * 
 * Portal component that renders sheet content outside normal DOM flow.
 * Usually not used directly - automatically included in SheetContent.
 * 
 * @param children - Content to portal
 * @param ...props - All Radix Dialog Portal props
 */
function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

/**
 * === Sheet Overlay Component ===
 * 
 * Semi-transparent backdrop behind the sheet content.
 * Includes click-to-close functionality and fade animations.
 * 
 * @param className - Additional CSS classes
 * @param ...props - All Radix Dialog Overlay props
 */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/**
 * === Sheet Content Component ===
 * 
 * Main content container that slides in from the specified edge.
 * Includes built-in close button and proper focus management.
 * 
 * @param side - Direction to slide from (top, right, bottom, left)
 * @param className - Additional CSS classes
 * @param children - Sheet content (header, body, footer, etc.)
 * @param ...props - All Radix Dialog Content props
 * 
 * @example
 * ```tsx
 * <SheetContent side="right" className="w-[400px]">
 *   <SheetHeader>
 *     <SheetTitle>Navigation</SheetTitle>
 *   </SheetHeader>
 *   <div className="py-4">Content here</div>
 * </SheetContent>
 * ```
 */
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

/**
 * === Sheet Header Component ===
 * 
 * Container for sheet title and description with consistent spacing.
 * Should contain SheetTitle and optionally SheetDescription.
 * 
 * @param className - Additional CSS classes
 * @param children - Header content (title, description)
 * @param ...props - All standard div props
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

/**
 * === Sheet Footer Component ===
 * 
 * Container for sheet actions like buttons, positioned at bottom.
 * Automatically sticks to bottom with proper spacing.
 * 
 * @param className - Additional CSS classes
 * @param children - Footer content (buttons, actions)
 * @param ...props - All standard div props
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

/**
 * === Sheet Title Component ===
 * 
 * Accessible title for the sheet dialog. Required for screen readers.
 * Should be used within SheetHeader for proper spacing.
 * 
 * @param className - Additional CSS classes
 * @param children - Title text
 * @param ...props - All Radix Dialog Title props
 */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

/**
 * === Sheet Description Component ===
 * 
 * Optional description text for the sheet dialog. 
 * Provides additional context for screen readers.
 * 
 * @param className - Additional CSS classes
 * @param children - Description text
 * @param ...props - All Radix Dialog Description props
 */
function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
