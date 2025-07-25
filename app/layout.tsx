export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Toaster } from "sonner";
import { dark } from "@clerk/themes";

import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mercora",
  description: "Marketplace powered by open knowledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
      }}
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
        >
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <Toaster
            position="top-center"
            toastOptions={{
              className:
                "bg-orange-500/80 text-black font-semibold rounded-md mt-[60px] shadow-lg animate-in fade-in slide-in-from-top-5",
              duration: 3000,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
