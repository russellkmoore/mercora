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
import { Home, Search, LogIn, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function HeaderClient({
  categories,
}: {
  categories: { id: number; name: string; slug: string }[];
}) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="flex justify-between items-center px-6 py-4 bg-black text-white">
      <Link href="/" className="text-xl font-bold">
        Voltique
      </Link>

      <div className="flex gap-4 items-center">
        <Button variant="ghost" className="text-white hover:bg-white hover:text-black bg-black">
          <Home className="mr-2 h-4 w-4" />
          Home
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-white hover:bg-white hover:text-black">
              Categories <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-white text-black">
            {categories.map((category) => (
              <DropdownMenuItem key={category.id} asChild>
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
              className="text-white hover:bg-white hover:text-black"
            >
              <Search className="mr-2 h-4 w-4" />
              Help & Search
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-white text-black transition-all duration-300 ease-in-out w-[400px]">
            <h2 className="text-lg font-semibold mb-2">Ask Voltique AI</h2>
            <div className="border rounded-md p-3 h-48 overflow-auto text-sm text-gray-700">
              <p><strong>You:</strong> How can I track my order?</p>
              <p className="mt-2"><strong>Voltique AI:</strong> You can track your order in the <em>Order History</em> page under your account dashboard.</p>
            </div>
            <input
              type="text"
              placeholder="Type your question..."
              className="mt-3 w-full border rounded px-3 py-2"
            />
          </SheetContent>
        </Sheet>

        <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-white hover:bg-white hover:text-black">
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
            <Button className="w-full mb-4">Submit</Button>

            <div className="flex gap-2 mb-4">
              <Button className="w-full">Apple</Button>
              <Button className="w-full">Google</Button>
              <Button className="w-full">GitHub</Button>
            </div>

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
            <Button className="w-full">Continue</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
