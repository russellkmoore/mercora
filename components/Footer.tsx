import Link from "next/link";
import { getNavigationPages } from "@/lib/models/pages";
import { getSocialMediaSettings } from "@/lib/utils/settings";
import { getStoreConfig } from "@/lib/store-config";

function safeSocialUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const GRID_CLASSES = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
} as const;

export default async function Footer() {
  const store = getStoreConfig();
  const [pagesResult, socialResult] = await Promise.allSettled([
    getNavigationPages(),
    getSocialMediaSettings(),
  ]);
  const pages = pagesResult.status === "fulfilled" ? pagesResult.value : [];
  const configuredSocial: Record<string, unknown> = socialResult.status === "fulfilled"
    ? socialResult.value
    : {};
  const socialSources: Array<[string, unknown]> = [
    ["Instagram", configuredSocial.instagram],
    ["YouTube", configuredSocial.youtube],
    ["LinkedIn", configuredSocial.linkedin],
    ["X", configuredSocial.twitter],
    ["Facebook", configuredSocial.facebook],
    ["TikTok", configuredSocial.tiktok],
  ];
  const social = socialSources.flatMap(([label, raw]) => {
    const href = safeSocialUrl(raw);
    return href ? [{ label, href }] : [];
  });

  const columns = [
    pages.length > 0 ? (
      <div key="pages" className="space-y-2">
        <h2 className="mb-3 font-semibold text-white">Explore</h2>
        {pages.map((page) => <Link key={page.id} href={`/${page.slug}`} className="block hover:text-white">{page.nav_title || page.title}</Link>)}
        {!pages.some(({ slug }) => slug === "blog") && <Link href="/blog" className="block hover:text-white">Blog</Link>}
      </div>
    ) : (
      <div key="pages" className="space-y-2">
        <h2 className="mb-3 font-semibold text-white">Explore</h2>
        <Link href="/products" className="block hover:text-white">Products</Link>
        <Link href="/blog" className="block hover:text-white">Blog</Link>
      </div>
    ),
    <div key="support" className="space-y-2">
      <h2 className="mb-3 font-semibold text-white">Support</h2>
      <a href={`mailto:${store.contact.supportEmail}`} className="block hover:text-white">Contact support</a>
      <Link href={store.urls.returns} className="block hover:text-white">Returns</Link>
      <Link href={store.urls.privacy} className="block hover:text-white">Privacy</Link>
      <Link href={store.urls.terms} className="block hover:text-white">Terms</Link>
    </div>,
    ...(social.length > 0 ? [
      <div key="social" className="space-y-2">
        <h2 className="mb-3 font-semibold text-white">Follow</h2>
        {social.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className="block hover:text-white">{item.label}</a>)}
      </div>,
    ] : []),
  ];
  const grid = GRID_CLASSES[Math.min(4, columns.length) as keyof typeof GRID_CLASSES];

  return (
    <footer className="relative z-10 mt-16 overflow-hidden bg-neutral-950 text-white">
      <div className={`relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 text-sm text-neutral-400 sm:grid-cols-2 sm:px-6 sm:py-16 ${grid}`}>
        {columns}
      </div>
      <div className="relative z-10 pb-4 pt-2 text-center text-xs text-neutral-500">
        ©{new Date().getFullYear()} {store.identity.name}. All rights reserved.
      </div>
      <div aria-hidden className="absolute bottom-0 left-4 select-none whitespace-nowrap text-6xl font-bold leading-none text-neutral-900 sm:text-8xl lg:text-9xl">
        {store.identity.name.toUpperCase()}
      </div>
    </footer>
  );
}
