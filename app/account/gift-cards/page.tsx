import { notFound } from 'next/navigation';
import { GiftCardDashboard } from '@/components/account/GiftCardDashboard';
import { getStoreConfig } from '@/lib/store-config';

export default function AccountGiftCardsPage() {
  if (!getStoreConfig().commerce.features.giftCardReconciliation) notFound();
  return <div><h1 className="text-3xl font-bold text-white">Gift cards</h1><p className="mt-2 text-gray-400">Review the gift cards you have purchased and their delivery state. Gift codes are never displayed here.</p><div className="mt-8"><GiftCardDashboard /></div></div>;
}
