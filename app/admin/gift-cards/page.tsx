import GiftCardQueue from '@/components/admin/GiftCardQueue';

export default function AdminGiftCardsPage() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Gift cards</h1><p className="mt-1 max-w-3xl text-gray-400">Operational gift-card status and delivery queue. Bearer codes, hashes, encryption material, recipient details, and internal card identities are intentionally unavailable.</p></div><GiftCardQueue /></div>;
}
