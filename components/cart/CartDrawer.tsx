import { useCartStore } from "@/lib/stores/cart-store";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import CartItemCard from "./CartItemCard";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const items = useCartStore((state) => state.items);

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
                    <CartItemCard key={item.id} item={item} />
                ))}
            </div>
            <div className="border-t pt-4 mt-4 text-right">
              <p className="font-semibold text-lg">Total: ${total.toFixed(2)}</p>
              <Button className="mt-3 w-full bg-black text-white hover:bg-orange-500">
                Checkout
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
