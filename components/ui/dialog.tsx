/**
 * === Dialog Component (shadcn/ui) ===
 *
 * A modal dialog component built with Radix UI Dialog primitives.
 * Provides an accessible, customizable overlay for displaying content
 * that requires user interaction or attention.
 *
 * === Features ===
 * - **Modal Behavior**: Blocks interaction with background content
 * - **Accessible**: Full keyboard navigation and screen reader support
 * - **Animated**: Smooth fade and zoom animations
 * - **Focus Management**: Traps focus within dialog when open
 * - **Portal Rendering**: Renders outside normal DOM flow
 * - **Customizable**: Flexible styling and content composition
 * - **Responsive**: Adapts to different screen sizes
 *
 * === Use Cases ===
 * - Confirmations and alerts
 * - Forms and data entry
 * - Content details and previews
 * - Settings and configuration
 * - Image/media lightboxes
 *
 * === Usage ===
 * ```tsx
 * <Dialog>
 *   <DialogTrigger>Open Dialog</DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirm Action</DialogTitle>
 *       <DialogDescription>This action cannot be undone.</DialogDescription>
 *     </DialogHeader>
 *     <div className="flex justify-end gap-2">
 *       <Button variant="outline">Cancel</Button>
 *       <Button>Confirm</Button>
 *     </div>
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * === Accessibility ===
 * - ARIA dialog implementation
 * - Focus trap management
 * - Escape key to close
 * - Screen reader announcements
 * - Proper heading hierarchy
 */

"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * === Dialog Root Component ===
 * 
 * Main container for the dialog. Manages open/close state
 * and provides context for all child components.
 */
const Dialog = DialogPrimitive.Root

/**
 * === Dialog Trigger Component ===
 * 
 * Button or element that opens the dialog when clicked.
 * Can be any clickable element or component.
 */
const DialogTrigger = DialogPrimitive.Trigger

/**
 * === Dialog Portal Component ===
 * 
 * Portal component that renders dialog content outside normal DOM flow.
 * Usually not used directly - automatically included in DialogContent.
 */
const DialogPortal = DialogPrimitive.Portal

/**
 * === Dialog Close Component ===
 * 
 * Button that closes the dialog. Can be placed anywhere within
 * the dialog content for programmatic closing.
 */
const DialogClose = DialogPrimitive.Close

/**
 * === Dialog Overlay Component ===
 * 
 * Semi-transparent backdrop behind the dialog content.
 * Provides modal behavior and fade animations.
 * 
 * @param className - Additional CSS classes
 * @param ref - Forwarded ref to overlay element
 * @param ...props - All Radix Dialog Overlay props
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * === Dialog Content Component ===
 * 
 * Main content container that appears in the center of the screen.
 * Includes built-in close button and proper focus management.
 * 
 * @param className - Additional CSS classes
 * @param children - Dialog content (header, body, footer, etc.)
 * @param ref - Forwarded ref to content element
 * @param ...props - All Radix Dialog Content props
 * 
 * @example
 * ```tsx
 * <DialogContent className="max-w-md">
 *   <DialogHeader>
 *     <DialogTitle>Delete Item</DialogTitle>
 *   </DialogHeader>
 *   <p>Are you sure you want to delete this item?</p>
 * </DialogContent>
 * ```
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * === Dialog Header Component ===
 * 
 * Container for dialog title and description with consistent spacing.
 * Should contain DialogTitle and optionally DialogDescription.
 * 
 * @param className - Additional CSS classes
 * @param children - Header content (title, description)
 * @param ...props - All standard div props
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * === Dialog Footer Component ===
 * 
 * Container for dialog actions like buttons with responsive layout.
 * Stacks vertically on mobile, horizontal on larger screens.
 * 
 * @param className - Additional CSS classes
 * @param children - Footer content (buttons, actions)
 * @param ...props - All standard div props
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

/**
 * === Dialog Title Component ===
 * 
 * Accessible title for the dialog. Required for screen readers.
 * Should be used within DialogHeader for proper spacing.
 * 
 * @param className - Additional CSS classes
 * @param children - Title text
 * @param ref - Forwarded ref to title element
 * @param ...props - All Radix Dialog Title props
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * === Dialog Description Component ===
 * 
 * Optional description text for the dialog.
 * Provides additional context for screen readers.
 * 
 * @param className - Additional CSS classes
 * @param children - Description text
 * @param ref - Forwarded ref to description element
 * @param ...props - All Radix Dialog Description props
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
