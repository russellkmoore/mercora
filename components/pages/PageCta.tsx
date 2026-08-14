import Link from "next/link";
import type { PageCtaConfig } from "@/lib/cms/page-template";

export default function PageCta({ config }: { config: PageCtaConfig }) {
  return (
    <section className="mt-8 border-t border-neutral-800 bg-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-white">{config.heading}</h2>
        {config.body && <p className="mt-2 text-neutral-300">{config.body}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {config.actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={action.variant === "primary"
                ? "rounded-lg bg-orange-600 px-6 py-2.5 font-medium text-white hover:bg-orange-700"
                : "rounded-lg border border-orange-500 px-6 py-2.5 font-medium text-orange-400 hover:bg-orange-500 hover:text-white"}
            >
              {action.label}
            </Link>
          ))}
        </div>
        {config.policyLinks.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            {config.policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-neutral-400 hover:text-orange-400">
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
