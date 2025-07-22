"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Home, Search, LogIn, ChevronDown, Send, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { FaApple, FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

export default function HeaderClient({
  categories,
}: {
  categories: { id: number; name: string; slug: string }[];
}) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500">
              <Search className="mr-2 h-4 w-4" />
              Help & Search
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-[#fdfdfb] text-black transition-all duration-300 ease-in-out w-[400px] px-3"
          >
            <h2 className="text-lg font-semibold mb-3 mt-2">Ask Voltique AI</h2>
            <div className="border rounded-md p-3 h-48 overflow-y-auto text-sm space-y-3">
              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-blue-100 text-right text-blue-900 px-3 py-2 rounded-lg max-w-[75%]">
                  <p>
                    <strong>You:</strong> How can I track my order?
                  </p>
                </div>
              </div>

              {/* AI response */}
              <div className="flex items-start space-x-2">
                <div className="h-6 w-6 flex items-center justify-center bg-orange-500 rounded-full text-white text-xs font-bold">
                  V
                </div>
                <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg max-w-[75%]">
                  <p>
                    <strong>Voltique AI:</strong> You can track your order in
                    the <em>Order History</em> page under your account
                    dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat input area */}
            <div className="mt-3 relative">
              <input
                type="text"
                placeholder="Type your question..."
                className="w-full border rounded pl-3 pr-10 py-2"
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black">
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Separator and placeholder for search results */}
            <hr className="my-4" />
            <div className="text-sm text-gray-600">
              Search results will appear here...
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In / Register
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white text-black transition-all duration-300 ease-in-out">
            <h2 className="text-xl font-bold mb-4">Sign In</h2>
            <input
              type="email"
              placeholder="Email address"
              className="mb-2 w-full border rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="Password"
              className="mb-2 w-full border rounded px-3 py-2"
            />
            <Button className="bg-black text-white hover:text-orange-500 border border-white hover:bg-white hover:border-orange-500">
              Submit
            </Button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300" />
              <span className="mx-2 text-gray-500 text-sm">or</span>
              <div className="flex-grow border-t border-gray-300" />
            </div>

            <Button className="w-full flex items-center gap-2 justify-center mb-2 bg-black text-white hover:bg-gray-800">
              <FaApple />
              Sign in with Apple
            </Button>
            <Button className="w-full flex items-center gap-2 justify-center mb-2 bg-black text-white hover:bg-gray-800">
              <FaGithub />
              Sign in with GitHub
            </Button>
            <Button className="w-full flex items-center gap-2 justify-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">
              <FcGoogle />
              Sign in with Google
            </Button>

            <hr className="my-4" />

            <h2 className="text-xl font-bold mb-2">Register</h2>
            <input
              type="email"
              placeholder="Email address"
              className="mb-2 w-full border rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="Password"
              className="mb-4 w-full border rounded px-3 py-2"
            />
            <Button className="bg-black text-white hover:text-orange-500 border border-white hover:bg-white hover:border-orange-500">
              Continue
            </Button>
          </DialogContent>
        </Dialog>

        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:text-orange-500 bg-black">
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-white text-black w-[400px] p-4">
            <h2 className="text-xl font-bold mb-4">Your Cart</h2>
            {/* Placeholder: Add cart items here */}
            <p>Your cart is empty.</p>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
