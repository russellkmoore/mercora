import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Order } from "@/lib/types/order";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

