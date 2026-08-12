import Link from "next/link";

const links = [
  ["Overview", "/account"],
  ["Orders", "/account/orders"],
  ["Addresses", "/account/addresses"],
  ["Settings", "/account/settings"],
] as const;

export function AccountNav() {
  return (
    <nav aria-label="Account" className="mb-8 flex flex-wrap gap-2 md:w-48 md:flex-col">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-gray-200 hover:border-orange-500 hover:text-orange-400">
          {label}
        </Link>
      ))}
    </nav>
  );
}
