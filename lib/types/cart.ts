import { CartItem } from "./cartitem";
export interface Cart {
  id: string; // could be session ID or user ID
  userId?: number;
  items: CartItem[];
  updatedAt: string;
}
