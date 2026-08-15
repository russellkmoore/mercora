import SubscriptionPlanManager from "@/components/admin/subscriptions/SubscriptionPlanManager";

export default function AdminSubscriptionPlansPage() {
  return (
    <div className="space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
        <p className="mt-1 max-w-3xl text-gray-400">
          Stage and manage exact catalog-to-Stripe Price bindings. Existing Stripe Prices must be created outside Mercora before a binding can be verified here.
        </p>
      </div>
      <SubscriptionPlanManager />
    </div>
  );
}
