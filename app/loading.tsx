/**
 * === Global Loading Component ===
 *
 * This component is automatically used by Next.js App Router as a fallback
 * UI while page components are loading. Provides consistent loading experience
 * across all pages in the application.
 *
 * === Features ===
 * - **Automatic Loading**: Next.js automatically displays during page transitions
 * - **Consistent UI**: Same spinner used throughout the application
 * - **Responsive Design**: Works well on all screen sizes
 * - **Brand Consistent**: Uses custom PageSpinner component
 *
 * === Technical Implementation ===
 * - **App Router Integration**: Automatically used by Next.js for loading states
 * - **Component Reuse**: Leverages shared UI loading component
 * - **Performance**: Lightweight and fast-rendering
 *
 * === Usage ===
 * This file is automatically used by Next.js App Router.
 * No manual importing required - Next.js handles it automatically.
 *
 * @returns JSX element with page loading spinner
 */

import { PageSpinner } from "@/components/ui/loading";

/**
 * Global loading component used by Next.js App Router
 * 
 * @returns Page spinner component for loading states
 */
export default function Loading() {
  return <PageSpinner />;
}
