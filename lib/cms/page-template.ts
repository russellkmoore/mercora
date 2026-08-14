export type PageTemplateKind = "guide" | "faq" | "contact" | "legal" | "story";

export type PageCtaAction = { label: string; href: string; variant: "primary" | "secondary" };
export type PageCtaConfig = {
  heading: string;
  body: string;
  actions: PageCtaAction[];
  policyLinks: Array<{ label: string; href: string }>;
};
export type PageTemplateConfig = {
  kind: PageTemplateKind;
  eyebrow: string;
  showRail: boolean;
  cta: PageCtaConfig | null;
};
export type PageTemplateContext = {
  storeName: string;
  assistantName: string;
  supportEmail: string;
  privacyUrl: string;
  termsUrl: string;
  returnsUrl: string;
  returnsConfigured: boolean;
};

export const MIN_SECTIONS_FOR_RAIL = 3;

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => {
      if (item && typeof item === "object") deepFreeze(item);
    });
  }
  return value;
}

function templates(context: PageTemplateContext): Record<PageTemplateKind, PageTemplateConfig> {
  const browse: PageCtaAction = { label: "Browse products", href: "/", variant: "primary" };
  const policyLinks = [
    ...(context.returnsConfigured ? [{ label: "Returns", href: context.returnsUrl }] : []),
    { label: "Privacy", href: context.privacyUrl },
    { label: "Terms", href: context.termsUrl },
  ];
  return deepFreeze({
    guide: {
      kind: "guide", eyebrow: "GUIDE", showRail: true,
      cta: { heading: "Continue exploring", body: `Browse ${context.storeName} products.`, actions: [browse], policyLinks: [] },
    },
    faq: {
      kind: "faq", eyebrow: "FREQUENTLY ASKED QUESTIONS", showRail: true,
      cta: {
        heading: "Still have a question?", body: "We are happy to help.",
        actions: [{ label: "Contact support", href: `mailto:${context.supportEmail}`, variant: "primary" }],
        policyLinks: [],
      },
    },
    legal: {
      kind: "legal", eyebrow: "POLICY", showRail: true,
      cta: {
        heading: "Need clarification?", body: "Contact us with any questions.",
        actions: [{ label: "Contact support", href: `mailto:${context.supportEmail}`, variant: "primary" }],
        policyLinks,
      },
    },
    contact: { kind: "contact", eyebrow: "CONTACT", showRail: false, cta: null },
    story: {
      kind: "story", eyebrow: "OUR STORY", showRail: false,
      cta: { heading: `Explore ${context.storeName}`, body: "", actions: [browse], policyLinks: [] },
    },
  });
}

export function resolveTemplate(
  template: string | null | undefined,
  context: PageTemplateContext,
): PageTemplateConfig {
  const registry = templates(context);
  return template && Object.prototype.hasOwnProperty.call(registry, template)
    ? registry[template as PageTemplateKind]
    : registry.story;
}

export function shouldShowRail(config: PageTemplateConfig, sectionCount: number): boolean {
  return config.showRail && sectionCount >= MIN_SECTIONS_FOR_RAIL;
}
