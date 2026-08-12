import { auth } from "@clerk/nextjs/server";
import { getCustomer } from "@/lib/models/mach/customer";
import { ProfileSettings } from "@/components/account/ProfileSettings";

export default async function SettingsPage() { const { userId } = await auth(); const customer = await getCustomer(userId!); return <div><h1 className="mb-6 text-3xl font-bold">Settings</h1><ProfileSettings firstName={customer?.person?.first_name ?? ""} lastName={customer?.person?.last_name ?? ""} /><p className="mt-6 max-w-xl text-sm text-gray-400">Account deletion and personal-data export are intentionally deferred and are not available in this release.</p></div>; }
