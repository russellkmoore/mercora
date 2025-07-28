/**
 * === Product Type Definition ===
 *
 * Comprehensive TypeScript interface for product entities throughout
 * the application. Defines the complete data structure for products
 * including pricing, inventory, media, and AI integration fields.
 *
 * === Features ===
 * - **Complete Product Data**: All product attributes in single interface
 * - **Pricing Support**: Regular pricing with sale price handling
 * - **Media Management**: Primary image and additional image arrays
 * - **Inventory Tracking**: Stock levels and availability status
 * - **SEO Optimization**: URL slugs and multi-level descriptions
 * - **AI Integration**: Special fields for AI assistant context
 * - **Flexible Attributes**: Key-value pairs for custom product data
 *
 * === Pricing Structure ===
 * - **price**: Base price in cents (e.g., 1999 = $19.99)
 * - **salePrice**: Optional sale price in cents
 * - **onSale**: Boolean flag to activate sale pricing
 *
 * === Availability States ===
 * - **available**: In stock and ready to ship
 * - **coming_soon**: Not yet available but can be viewed
 *
 * === Image Handling ===
 * - **primaryImageUrl**: Main product image for cards/listings
 * - **images**: Array of additional images for galleries
 * - **Null Safety**: Primary image can be null (falls back to placeholder)
 *
 * === AI Integration ===
 * - **aiNotes**: Special context for AI assistant recommendations
 * - **tags**: Searchable tags for AI product matching
 * - **useCases**: Contextual usage scenarios for AI suggestions
 *
 * === Usage ===
 * ```typescript
 * const product: Product = {
 *   id: 1,
 *   name: "Arctic Pulse Tool",
 *   price: 14999, // $149.99
 *   availability: "available",
 *   // ... other required fields
 * };
 * ```
 */

/**
 * Complete product interface defining all product-related data
 * 
 * This interface represents the full product entity as used throughout
 * the application, from database queries to component props.
 */
export interface Product {
  // === Core Identity ===
  id: number;                                         // Unique product identifier
  name: string;                                       // Display name for product
  slug: string;                                       // URL-friendly identifier
  
  // === Content & SEO ===
  shortDescription: string;                           // Brief product summary
  longDescription: string;                            // Detailed product description
  
  // === Media ===
  primaryImageUrl: string | null;                     // Main product image URL
  images: string[];                                   // Additional product images
  
  // === Pricing (all amounts in cents) ===
  price: number;                                      // Base price in cents
  salePrice?: number;                                 // Optional sale price in cents
  onSale?: boolean;                                   // Sale activation flag
  
  // === Inventory & Status ===
  active: boolean;                                    // Product visibility flag
  quantityInStock: number;                            // Available inventory count
  availability: 'available' | 'coming_soon';         // Stock availability status
  
  // === Categorization & Search ===
  tags: string[];                                     // Searchable product tags
  useCases: string[];                                 // Product usage scenarios
  attributes: Record<string, string>;                 // Custom key-value attributes
  
  // === AI Integration ===
  aiNotes?: string;                                   // Special context for AI assistant
}