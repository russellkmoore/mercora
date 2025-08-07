import type { CartItem } from "./cartitem";
import type { ShippingOption } from "./shipping";
import type { Address } from "./address";
import type { BillingInfo } from "./billing";

export type OrderStatus =
  | "incomplete"
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string; 
  userId?: string; 

  items: CartItem[];

  shippingAddress: Address;
  billingAddress?: Address;

  shippingOption: ShippingOption;
  billingInfo: BillingInfo;

  taxAmount: number;
  shippingCost: number;
  total: number;

  email: string; 

  status: OrderStatus;
  
  // Shipping tracking fields
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  
  // Additional metadata
  cancellationReason?: string;
  notes?: string;
  
  createdAt: string; // ISO format
  updatedAt: string;
};
