/**
 * === Utility Functions Library ===
 *
 * Common utility functions for the application, focusing on CSS class
 * management and string manipulation. Provides type-safe helpers for
 * consistent styling and component composition.
 *
 * === Features ===
 * - **Class Name Merging**: Intelligent Tailwind CSS class combination
 * - **Conditional Styling**: Support for conditional class application
 * - **Conflict Resolution**: Automatic handling of conflicting Tailwind classes
 * - **Type Safety**: Full TypeScript support with proper type inference
 * - **Performance**: Optimized class string generation and deduplication
 *
 * === Technical Implementation ===
 * - **clsx Integration**: Flexible conditional class name construction
 * - **Tailwind Merge**: Intelligent conflict resolution for Tailwind classes
 * - **Type Definitions**: Proper TypeScript types for class value inputs
 *
 * === Class Merging Logic ===
 * The `cn` function combines multiple approaches:
 * 1. clsx() handles conditional logic and array/object inputs
 * 2. twMerge() resolves Tailwind class conflicts intelligently
 * 3. Result is optimized, deduplicated class string
 *
 * === Usage Examples ===
 * ```typescript
 * // Basic class combination
 * cn("bg-red-500", "text-white") // "bg-red-500 text-white"
 * 
 * // Conditional classes
 * cn("bg-blue-500", { "text-white": isActive }) // "bg-blue-500 text-white" if isActive
 * 
 * // Conflict resolution
 * cn("bg-red-500", "bg-blue-500") // "bg-blue-500" (later wins)
 * 
 * // Complex combinations
 * cn(
 *   "px-4 py-2",
 *   variant === "primary" && "bg-blue-500 text-white",
 *   variant === "secondary" && "bg-gray-200 text-gray-900",
 *   className
 * )
 * ```
 *
 * === Performance Benefits ===
 * - Efficient string concatenation and deduplication
 * - Optimized Tailwind class conflict resolution
 * - Minimal runtime overhead for class processing
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine and merge CSS class names with intelligent conflict resolution
 * 
 * This utility function combines clsx for conditional logic with tailwind-merge
 * for resolving conflicting Tailwind CSS classes. It's the standard way to
 * handle dynamic class names throughout the application.
 * 
 * @param inputs - Variable number of class values (strings, objects, arrays, etc.)
 * @returns Optimized and deduplicated class name string
 * 
 * @example
 * ```typescript
 * // Basic usage
 * cn("bg-red-500", "text-white")
 * 
 * // With conditions
 * cn("base-class", { "active-class": isActive, "disabled-class": isDisabled })
 * 
 * // Conflict resolution
 * cn("bg-red-500", "bg-blue-500") // Results in "bg-blue-500"
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
