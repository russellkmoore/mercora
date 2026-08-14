"use client";

import { useEffect, useRef, useState } from "react";
import type { PageSection } from "@/lib/cms/page-sections";

export default function PageRail({ sections }: { sections: PageSection[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const visible = useRef(new Map<string, boolean>());
  useEffect(() => {
    const elements = sections.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;
    visible.current = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.current.set(entry.target.id, entry.isIntersecting));
      setActiveId(sections.find(({ id }) => visible.current.get(id))?.id ?? null);
    }, { rootMargin: "-96px 0px -65% 0px", threshold: 0 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav aria-label="On this page" className="sticky top-24 hidden self-start lg:block">
      <p className="mb-3 text-xs uppercase tracking-widest text-neutral-500">On this page</p>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`block border-l-2 py-2 pl-3 text-sm transition-colors ${
            activeId === section.id
              ? "border-orange-500 font-semibold text-orange-400"
              : "border-neutral-700 text-neutral-400 hover:border-orange-500 hover:text-white"
          }`}
        >
          {section.heading}
        </a>
      ))}
    </nav>
  );
}
