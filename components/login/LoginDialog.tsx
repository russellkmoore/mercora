"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { FaApple, FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";

export default function LoginDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
  );
}
