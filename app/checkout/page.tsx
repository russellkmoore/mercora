import CheckoutClient from '@/components/checkout/CheckoutClient';
import { auth } from '@clerk/nextjs/server'



export default async function CheckoutPage() {
  const { userId } = await auth();
  return (
    <main className="bg-neutral-900 text-white min-h-screen px-6 sm:px-12 py-16">
        <div className="max-w-6xl mx-auto p-6">
            <CheckoutClient userId={userId} />
        </div>
    </main>
  );
}

