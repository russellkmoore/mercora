"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PageSection } from "@/lib/cms/page-sections";

export function decodeFaqHash(hash: string): string | null {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
}

export default function FaqAccordion({ sections, lead }: { sections: PageSection[]; lead?: string }) {
  const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeFaqHash(window.location.hash);
      if (id !== null && sections.some((section) => section.id === id)) setOpenId(id);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [sections]);
  return (
    <>
      {lead && <div className="prose prose-invert prose-orange mb-5 max-w-none" dangerouslySetInnerHTML={{ __html: lead }} />}
      <div className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900">
        {sections.map((section) => {
          const open = section.id === openId;
          return (
            <div key={section.id} id={section.id} className="scroll-mt-24 border-b border-neutral-700 last:border-0">
              <h2>
                <button type="button" onClick={() => setOpenId(open ? null : section.id)} aria-expanded={open} aria-controls={`${section.id}-answer`} className="flex w-full items-center gap-3 px-5 py-4 text-left text-lg text-white hover:bg-neutral-800">
                  <span className="flex-1">{section.heading}</span>
                  <ChevronDown aria-hidden className={`h-5 w-5 text-orange-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </h2>
              {open && <div id={`${section.id}-answer`} className="prose prose-invert prose-orange max-w-none px-5 pb-5" dangerouslySetInnerHTML={{ __html: section.html }} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
