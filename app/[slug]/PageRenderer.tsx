import type { PageSelect } from "@/lib/db/schema/pages";
import { sanitizePageHtmlServer } from "@/lib/utils/sanitize-html-server";
import { parsePageHtml } from "@/lib/cms/page-sections";
import { resolveSectionProducts } from "@/lib/cms/page-products";
import { resolveTemplate, shouldShowRail } from "@/lib/cms/page-template";
import ContactGrid from "@/components/pages/ContactGrid";
import CustomPageAssets from "@/components/pages/CustomPageAssets";
import FaqAccordion from "@/components/pages/FaqAccordion";
import LegalDocument from "@/components/pages/LegalDocument";
import PageCta from "@/components/pages/PageCta";
import PageHero from "@/components/pages/PageHero";
import PageRail from "@/components/pages/PageRail";
import SectionCard from "@/components/pages/SectionCard";
import StoryBody from "@/components/pages/StoryBody";

type PageRendererProps = {
  page: PageSelect;
  allowedImageOrigin?: string;
  customJsEnabled?: boolean;
  storeName: string;
  supportEmail: string;
  assistantName: string;
  privacyUrl: string;
  termsUrl: string;
  returnsUrl: string;
  returnsConfigured: boolean;
};

export default async function PageRenderer({
  page,
  allowedImageOrigin,
  customJsEnabled = false,
  storeName,
  supportEmail,
  assistantName,
  privacyUrl,
  termsUrl,
  returnsUrl,
  returnsConfigured,
}: PageRendererProps) {
  const template = resolveTemplate(page.template, {
    storeName, assistantName, supportEmail, privacyUrl, termsUrl, returnsUrl, returnsConfigured,
  });
  const sanitized = sanitizePageHtmlServer(page.content, { allowedImageOrigin });
  const parsed = parsePageHtml(sanitized, {
    pageTitle: page.title,
    promoteLede: !page.excerpt,
    extractConventions: template.kind === "guide",
    liftUpdatedLabel: template.kind === "legal",
  });
  const lede = page.excerpt || parsed.lede;
  const products = template.kind === "guide"
    ? await resolveSectionProducts(parsed.sections)
    : new Map();
  const showRail = shouldShowRail(template, parsed.sections.length);

  const body = (() => {
    switch (template.kind) {
      case "guide":
        return (
          <div>
            {parsed.lead && <div className="prose prose-invert prose-orange mb-5 max-w-none" dangerouslySetInnerHTML={{ __html: parsed.lead }} />}
            {parsed.sections.map((section) => <SectionCard key={section.id} section={section} product={products.get(section.id)} />)}
          </div>
        );
      case "faq":
        return <FaqAccordion sections={parsed.sections} lead={parsed.lead} />;
      case "contact":
        return <ContactGrid sections={parsed.sections} lead={parsed.lead} />;
      case "legal":
        return <LegalDocument updatedLabel={parsed.updatedLabel} lead={parsed.lead} sections={parsed.sections} />;
      case "story":
        return <StoryBody lead={parsed.lead} sections={parsed.sections} />;
    }
  })();

  return (
    <>
      <CustomPageAssets
        pageId={page.id}
        customCss={page.custom_css}
        customJsPath={customJsEnabled && page.custom_js
          ? `/api/pages/${encodeURIComponent(page.slug)}/script`
          : null}
      />
      <PageHero eyebrow={template.eyebrow} title={page.title} lede={lede} />
      <div className={`mx-auto max-w-5xl px-4 py-10 sm:px-6 ${showRail ? "lg:grid lg:grid-cols-[180px_1fr] lg:gap-10" : ""}`}>
        {showRail && <PageRail sections={parsed.sections} />}
        <div className="min-w-0">{body}</div>
      </div>
      {template.cta && <PageCta config={template.cta} />}
    </>
  );
}
