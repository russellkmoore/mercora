import Link from "next/link";
import type { PageCtaConfig } from "@/lib/cms/page-template";

export default function PageCta({ config }: { config: PageCtaConfig }) {
  return (
    <section className="mt-8 border-t border-border bg-surface-elevated">
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-foreground font-display">{config.heading}</h2>
        {config.body && <p className="mt-2 text-muted-foreground">{config.body}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {config.actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={action.variant === "primary"
                ? "rounded-lg bg-primary px-6 py-2.5 font-medium text-on-primary hover:bg-primary/80"
                : "rounded-lg border border-primary px-6 py-2.5 font-medium text-primary hover:bg-primary hover:text-on-primary"}
            >
              {action.label}
            </Link>
          ))}
        </div>
        {config.policyLinks.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            {config.policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-primary/90">
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
