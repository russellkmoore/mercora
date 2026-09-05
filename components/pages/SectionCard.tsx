import Image from "next/image";
import Link from "next/link";
import type { PageSection } from "@/lib/cms/page-sections";
import type { ProductCardData } from "@/lib/cms/page-products";

export default function SectionCard({ section, product }: { section: PageSection; product?: ProductCardData }) {
  return (
    <section id={section.id} className="mb-5 scroll-mt-24 rounded-xl border border-border bg-surface-elevated p-6">
      <div className={product ? "grid gap-7 sm:grid-cols-[1fr_168px]" : ""}>
        <div>
          <h2 className="text-2xl font-semibold text-foreground font-display">{section.heading}</h2>
          {section.specs.length > 0 && (
            <ul className="my-4 flex list-none flex-wrap gap-2 p-0">
              {section.specs.map((spec) => (
                <li key={spec} className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground">{spec}</li>
              ))}
            </ul>
          )}
          <div className="prose prose-invert prose-orange max-w-none" dangerouslySetInnerHTML={{ __html: section.html }} />
          {!product && section.productFallbackHtml && (
            <div
              className="prose prose-invert prose-orange mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: section.productFallbackHtml }}
            />
          )}
          {section.callouts.map((callout) => (
            <p key={callout} className="mt-4 rounded-r-lg border-l-4 border-primary bg-surface-elevated p-4 text-muted-foreground">{callout}</p>
          ))}
        </div>
        {product && (
          <div className="text-center">
            <Link href={`/product/${product.slug}`}>
              <Image src={product.imageKey} alt={product.name} width={168} height={224} className="w-full rounded-lg border border-border" />
            </Link>
            <p className="mt-3 text-sm font-semibold text-foreground">{product.name}</p>
            {product.price && <p className="mt-1 text-sm text-muted-foreground">{product.price}</p>}
            <Link href={`/product/${product.slug}`} className="mt-3 block rounded-md border border-primary px-3 py-2 text-sm text-primary hover:bg-primary hover:text-on-primary">
              View product
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
