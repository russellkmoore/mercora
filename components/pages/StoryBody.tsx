import type { PageSection } from "@/lib/cms/page-sections";

const PROSE = "prose prose-invert prose-orange mx-auto max-w-3xl prose-img:w-full prose-img:rounded-xl";

export default function StoryBody({ lead, sections }: { lead: string; sections: PageSection[] }) {
  return (
    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 sm:p-10">
      {lead && <div className={PROSE} dangerouslySetInnerHTML={{ __html: lead }} />}
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mx-auto mt-8 max-w-3xl scroll-mt-24">
          <h2 className="mb-3 text-2xl font-semibold text-white">{section.heading}</h2>
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: section.html }} />
        </section>
      ))}
    </article>
  );
}
