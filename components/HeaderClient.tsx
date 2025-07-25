"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Home, Search, LogIn, ChevronDown, ShoppingCart } from "lucide-react";
import AgentDrawer from "@/components/agent/AgentDrawer";
import ClerkLogin from "@/components/login/ClerkLogin";
import CartDrawer from "@/components/cart/CartDrawer";

export default function HeaderClient({
  categories,
}: {
  categories: { id: number; name: string; slug: string }[];
}) {
  return (
    <div className="flex justify-between items-center px-6 py-4 bg-black text-white">
      <Link href="/" className="text-xl font-bold">
        Voltique
      </Link>

      <div className="flex gap-4 items-center">
        <Link href="/" passHref>
          <Button
            variant="ghost"
            className="text-white hover:bg-white hover:text-orange-500 bg-black"
          >
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500"
            >
              Categories <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white text-black">
            {categories.map((category) => (
              <DropdownMenuItem
                className="hover:text-orange-500 hover:border-l-2 border-orange-500 pl-4"
                key={category.id}
                asChild
              >
                <Link href={`/category/${category.slug}`} className="w-full">
                  {category.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <AgentDrawer />
        <ClerkLogin />
        <CartDrawer />
      </div>
    </div>
  );
}
