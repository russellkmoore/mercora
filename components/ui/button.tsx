/**
 * === Button Component (shadcn/ui) ===
 *
 * A flexible, accessible button component built with Radix UI primitives and
 * styled with Tailwind CSS. Provides multiple variants, sizes, and states
 * with consistent design patterns across the application.
 *
 * === Features ===
 * - **Multiple Variants**: default, destructive, outline, secondary, ghost, link
 * - **Size Options**: sm, default, lg, icon for different use cases
 * - **Accessibility**: Full keyboard navigation and screen reader support
 * - **Polymorphic**: Can render as different elements using asChild prop
 * - **Icon Support**: Built-in icon handling with proper sizing
 * - **Focus Management**: Visible focus indicators and ring states
 * - **Disabled States**: Proper disabled styling and behavior
 *
 * === Variants ===
 * - **default**: Primary brand button with filled background
 * - **destructive**: Danger/warning actions with red styling
 * - **outline**: Secondary actions with border styling
 * - **secondary**: Alternative secondary styling
 * - **ghost**: Minimal styling for subtle actions
 * - **link**: Text-only button styled as a link
 *
 * === Sizes ===
 * - **sm**: Compact button for desktop layouts (40px height - mobile optimized)
 * - **default**: Standard button size (44px height - mobile-first)
 * - **lg**: Large button for primary actions (48px height)
 * - **xl**: Extra large for key CTAs (56px height)
 * - **icon**: Square button optimized for icons (44px x 44px - mobile touch)
 *
 * === Usage ===
 * ```tsx
 * <Button variant="default" size="lg">Click me</Button>
 * <Button variant="outline" size="sm">Cancel</Button>
 * <Button variant="ghost" size="icon"><Icon /></Button>
 * ```
 *
 * === Accessibility ===
 * - Proper ARIA attributes and states
 * - Keyboard navigation support
 * - Focus management and indicators
 * - Screen reader compatibility
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button variant styles using class-variance-authority
 * Defines all possible combinations of variants and sizes
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3", // 44px mobile-first
        sm: "h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5", // 40px mobile optimized
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4", // 48px for primary actions
        xl: "h-14 rounded-md px-8 has-[>svg]:px-6", // 56px for key CTAs
        icon: "size-11", // 44px x 44px mobile touch
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Button Component Props Interface
 * Extends HTML button attributes with variant and size options
 */
export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /** 
   * Render button as child component (useful for Next.js Link, etc.)
   * When true, passes all props to first child element 
   */
  asChild?: boolean
}

/**
 * === Button Component ===
 * 
 * Primary button component with multiple variants and sizes.
 * Built on shadcn/ui design system with Radix UI primitives.
 * 
 * @param variant - Button style variant
 * @param size - Button size option
 * @param asChild - Render as child component (polymorphic)
 * @param className - Additional CSS classes
 * @param children - Button content (text, icons, etc.)
 * @param ...props - All standard HTML button attributes
 * 
 * @example
 * ```tsx
 * // Primary button
 * <Button variant="default">Save Changes</Button>
 * 
 * // Outline button with icon
 * <Button variant="outline" size="sm">
 *   <Icon className="w-4 h-4" />
 *   Edit
 * </Button>
 * 
 * // As Next.js Link
 * <Button asChild>
 *   <Link href="/dashboard">Go to Dashboard</Link>
 * </Button>
 * 
 * // Icon only button
 * <Button variant="ghost" size="icon">
 *   <CloseIcon />
 * </Button>
 * ```
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
