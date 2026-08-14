import { Clock, HelpCircle, Mail, Package } from "lucide-react";
import type { PageSection } from "@/lib/cms/page-sections";

const ICONS = [
  { match: /email|write|message/i, Icon: Mail },
  { match: /order|shipping|delivery|return/i, Icon: Package },
  { match: /hour|time|support/i, Icon: Clock },
];

export default function ContactGrid({ sections, lead }: { sections: PageSection[]; lead: string }) {
  return (
    <div>
      {lead && <div className="prose prose-invert prose-orange mb-6 max-w-none" dangerouslySetInnerHTML={{ __html: lead }} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section, index) => {
          const Icon = ICONS.find(({ match }) => match.test(section.heading))?.Icon ?? HelpCircle;
          const wide = index === sections.length - 1 && sections.length % 2 === 1;
          return (
            <section key={section.id} id={section.id} className={`scroll-mt-24 rounded-xl border border-neutral-700 bg-neutral-900 p-6 ${wide ? "sm:col-span-2" : ""}`}>
              <Icon aria-hidden className="mb-3 h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
              <div className="prose prose-invert prose-orange mt-2 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: section.html }} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
