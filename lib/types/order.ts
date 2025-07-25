import type { CartItem } from "./cartitem";
import type { ShippingOption } from "./shipping";
import type { Address } from "./address";
import type { BillingInfo } from "./billing";

export type OrderStatus =
  | "incomplete"
  | "pending"
  | "paid"
  | "fulfilled"
  | "shipped"
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
  createdAt: string; // ISO format
  updatedAt: string;
};
