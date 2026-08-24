import { notFound } from 'next/navigation';
import { SubscriptionManager } from '@/components/account/SubscriptionManager';
import { getStoreConfig } from '@/lib/store-config';

export default function AccountSubscriptionsPage() {
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) notFound();
  return <div><h1 className="text-3xl font-bold text-white">Subscriptions</h1><p className="mt-2 text-gray-400">Review recurring plans and request changes to collection or cancellation.</p><div className="mt-8"><SubscriptionManager /></div></div>;
}
