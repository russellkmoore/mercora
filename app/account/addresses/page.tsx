import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/models/mach/customer";
import { AddressManager } from "@/components/account/AddressManager";

export default async function AddressesPage() { const { userId } = await auth(); if (!userId) redirect("/sign-in?redirect_url=/account/addresses"); const customer = await getCustomer(userId); return <div><h1 className="mb-6 text-3xl font-bold">Addresses</h1><AddressManager initial={customer?.addresses ?? []} /></div>; }
