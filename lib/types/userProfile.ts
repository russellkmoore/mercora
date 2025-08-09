import { Customer } from ".";
import { Order } from ".";
// User authentication and profile (hybrid Clerk + MACH)
export interface UserProfile extends Customer {
  // Clerk-specific fields
  clerkId?: string;
  isGuest: boolean;
  
  // Enhanced user context
  orderHistory?: Order[];
  preferences?: {
    currency: string;
    language: string;
    marketing?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };

  // Computed fields for personalization
  totalOrderValue?: number;
  averageOrderValue?: number;
  isVipCustomer?: boolean;
  lastOrderDate?: string;
  favoriteCategories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
}
