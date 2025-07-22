// components/ProductCard.tsx
import Image from "next/image";
import Link from "next/link";

export interface ProductCardProps {
  id: number;
  name: string;
  slug: string;
  description?: string;
  primaryImageUrl?: string | null;
}

export default function ProductCard({
  id,
  name,
  slug,
  description,
  primaryImageUrl,
}: ProductCardProps) {
  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden shadow hover:shadow-lg transition">
      <div className="aspect-video bg-neutral-700 relative">
        <Link href={`/product/${slug}`} className="block relative aspect-video">
          {primaryImageUrl ? (
            <Image
              src={`${primaryImageUrl.replace(/^\/+/, '')}`}
              alt={name}
              fill
              objectFit="cover"
              className="rounded-sm"
              />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xl">
              No Image
            </div>
          )}
        </Link>
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold mb-2">{name}</h3>
        {description && (
          <p className="text-gray-400 text-sm mb-4">{description}</p>
        )}
        <a
          href={`/product/${slug}`}
          className="text-orange-500 hover:underline text-sm font-medium"
        >
          Learn more →
        </a>
      </div>
    </div>
  );
}