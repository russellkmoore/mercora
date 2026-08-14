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
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import CartItemCard from "./CartItemCard";
import { Button } from "@/components/ui/button";
import { ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cartSubtotal, Money } from "@/lib/money";
import { useCartHydration } from "@/lib/hooks/useCartHydration";
import { useCartUIStore } from "@/lib/stores/cart-ui-store";

/**
 * CartDrawer component providing shopping cart functionality
 * 
 * @returns JSX element representing a sliding cart drawer with items and totals
 */
export default function CartDrawer() {
  const isOpen = useCartUIStore((state) => state.isOpen);
  const setCartOpen = useCartUIStore((state) => state.setCartOpen);
  const isHydrated = useCartHydration();
  const items = useCartStore((state) => state.items) || [];

  // Calculate total price for all items in cart with safety checks
  const total = cartSubtotal(items);

  // Only show real count after mounting to prevent hydration mismatch
  const itemCount = isHydrated ? items.length : 0;

  return (
    <Sheet open={isOpen} onOpenChange={setCartOpen}>
      <SheetContent 
        side="right"
        className="bg-[#fdfdfb] text-black  transition-all ease-in-out px-3 w-full sm:w-[400px] max-w-[400px]! duration-600! data-[state=closed]:duration-600! data-[state=open]:duration-600! flex flex-col h-full border-neutral-800"
      >
        {/* Accessibility components */}
        <VisuallyHidden>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            Review and manage items in your shopping cart before checkout.
          </SheetDescription>
        </VisuallyHidden>

        {/* Custom Close Button */}
        <div className="absolute top-4 right-4 z-10">
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close cart</span>
            </Button>
          </SheetClose>
        </div>

        <div className="py-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Your Cart
          </h2>
          
          {itemCount === 0 ? (
            <div className="text-gray-400 text-center py-8">
              Your cart is empty
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <CartItemCard key={item.variantId} item={item} />
              ))}
              
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total: {total.format()}</span>
                </div>
                
                <Button
                  asChild
                  className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
                >
                  <Link href="/checkout" onClick={() => setCartOpen(false)}>
                    Proceed to Checkout
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CartTrigger() {
  const isHydrated = useCartHydration();
  const itemCount = useCartStore((state) => state.items)?.length ?? 0;
  const openCart = useCartUIStore((state) => state.openCart);
  const count = isHydrated ? itemCount : 0;
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={openCart}
      aria-label={`Cart (${count} ${count === 1 ? "item" : "items"})`}
      className="relative text-white hover:bg-white hover:text-orange-500"
    >
      <ShoppingCart className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Cart ({count})</span>
      {count > 0 && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">{count}</span>}
    </Button>
  );
}
