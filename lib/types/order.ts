import { CartItem } from "./cartitem";
export interface Order {
  id: number;
  userId?: number;
  items: CartItem[];
  total: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
  createdAt: string;
  updatedAt: string;
}