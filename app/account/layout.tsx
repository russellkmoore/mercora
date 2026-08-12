import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/AccountNav";
import { getStoreConfig } from "@/lib/store-config";

export async function generateMetadata() {
  return { title: `Account - ${getStoreConfig().identity.name}` };
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/account");
  return <div className="min-h-screen bg-neutral-950 px-4 py-12 text-white sm:px-6"><div className="mx-auto max-w-6xl md:flex md:gap-8"><AccountNav /><div className="min-w-0 flex-1">{children}</div></div></div>;
}
