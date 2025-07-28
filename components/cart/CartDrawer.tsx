/**
 * === Cart Drawer Component ===
 *
 * A sliding shopping cart interface that provides users with quick access to
 * their cart items, total calculations, and checkout functionality. Implements
 * persistent cart state and real-time updates.
 *
 * === Features ===
 * - **Persistent Cart State**: Uses Zustand store for cart persistence
 * - **Real-time Updates**: Instant reflection of quantity changes
 * - **Total Calculations**: Automatic price calculations and updates
 * - **Item Management**: Add, remove, and modify cart items
 * - **Quick Checkout**: Direct link to checkout process
 * - **Responsive Design**: Works across all device sizes
 * - **Visual Indicators**: Item count badge and empty state handling
 *
 * === Cart Functionality ===
 * - **Item Display**: Shows product image, name, price, quantity
 * - **Quantity Controls**: Increase/decrease item quantities
 * - **Item Removal**: Remove items from cart
 * - **Total Calculation**: Real-time price totals with currency formatting
 * - **Empty State**: Helpful message when cart is empty
 *
 * === State Management ===
 * - **Zustand Store**: Persistent cart state across sessions
 * - **Local Storage**: Cart survives browser refreshes
 * - **Real-time Sync**: Immediate UI updates on state changes
 *
 * === Usage ===
 * ```tsx
 * <CartDrawer />
 * ```
 * 
 * No props required - manages its own state and integrates with cart store.
 *
 * === Integration ===
 * - **CartItemCard**: Individual cart item display and management
 * - **Cart Store**: Global cart state management
 * - **Checkout Flow**: Direct integration with checkout process
 */

import { useCartStore } from "@/lib/stores/cart-store";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import CartItemCard from "./CartItemCard";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

/**
 * CartDrawer component providing shopping cart functionality
 * 
 * @returns JSX element representing a sliding cart drawer with items and totals
 */
export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const items = useCartStore((state) => state.items);

  // Calculate total price for all items in cart
  const total = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="text-white hover:bg-white hover:text-orange-500 bg-black relative"
        >
          <ShoppingCart className="h-5 w-5" />
          {items.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {items.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-white text-black w-[400px] p-4">
        {/* Left fade */}
        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-r from-black/20 to-transparent z-10 pointer-events-none" />

        <h2 className="text-xl font-bold mb-4">Your Cart</h2>
        {items.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto pr-2 space-y-4">
              {items.map((item) => (
                <CartItemCard key={item.productId} item={item} />
              ))}
            </div>
            <div className="border-t pt-4 mt-4 text-right">
              <p className="font-semibold text-lg">
                Total: ${total.toFixed(2)}
              </p>
              <Button
                className="mt-3 w-full bg-black text-white hover:bg-orange-500"
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => {
                    window.location.href = "/checkout";
                  }, 100);
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
