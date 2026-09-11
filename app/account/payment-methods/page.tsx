import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PaymentMethodList } from "@/components/account/PaymentMethodList";

export default async function PaymentMethodsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/account/payment-methods");
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-display">Payment methods</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cards are saved during checkout when you choose to save your card for next time.
      </p>
      <PaymentMethodList />
    </div>
  );
}
