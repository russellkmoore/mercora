import type { PageSection } from "@/lib/cms/page-sections";

export default function LegalDocument({
  updatedLabel,
  lead,
  sections,
}: { updatedLabel: string | null; lead: string; sections: PageSection[] }) {
  return (
    <article className="rounded-xl border border-border bg-surface-elevated p-6 sm:p-8">
      {updatedLabel && <p className="mb-5 inline-block rounded-full bg-surface-elevated px-3 py-1 text-xs text-muted-foreground">{updatedLabel}</p>}
      {lead && <div className="prose prose-invert prose-orange max-w-none" dangerouslySetInnerHTML={{ __html: lead }} />}
      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className={`scroll-mt-24 ${index || lead ? "mt-7 border-t border-border pt-5" : ""}`}>
          <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
          <div className="prose prose-invert prose-orange mt-2 max-w-none" dangerouslySetInnerHTML={{ __html: section.html }} />
        </section>
      ))}
    </article>
  );
}
