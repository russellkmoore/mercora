export default function PageHero({
  eyebrow,
  title,
  lede,
}: { eyebrow: string; title: string; lede: string | null }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">{title}</h1>
        {lede && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-neutral-300">{lede}</p>}
      </div>
    </header>
  );
}
