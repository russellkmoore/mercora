import { normalizePageHtml } from "./page-html";

export interface PageSection {
  id: string;
  heading: string;
  html: string;
  specs: string[];
  productSlug: string | null;
  productFallbackHtml: string | null;
  callouts: string[];
}

export interface ParsedPage {
  updatedLabel: string | null;
  lede: string | null;
  lead: string;
  sections: PageSection[];
}

const CLASS_TOKEN = (token: string) => `class="(?:[^"]*\\s)?${token}(?:\\s[^"]*)?"`;
const SPECS_LIST = new RegExp(`<ul\\b[^>]*${CLASS_TOKEN("specs")}[^>]*>([\\s\\S]*?)<\\/ul>`, "gi");
const PRODUCT_FIGURE = new RegExp(
  `<figure\\b[^>]*class="(?:[^"]*\\s)?(?:product|blend)(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)<\\/figure>`,
  "gi",
);
const BLOCKQUOTE = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
const LIST_ITEM = /<li[^>]*>([\s\S]*?)<\/li>/gi;
const FIRST_PARAGRAPH = /<p>([\s\S]*?)<\/p>/i;
const UPDATED_PARAGRAPH = /^\s*<p><strong>Last Updated:<\/strong>([\s\S]*?)<\/p>/i;
const LEADING_H1 = /^\s*<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i;
const PRODUCT_HREF = /href="(?:https?:\/\/[^"/]+)?\/product\/([a-z0-9-]+)"/i;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHeading(text: string): string {
  return toText(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

function topLevelH2Boundaries(html: string) {
  const boundaries: { heading: string; start: number; end: number }[] = [];
  let depth = 0;
  let open: { start: number; contentStart: number } | null = null;
  for (const match of html.matchAll(TAG)) {
    const name = match[2].toLowerCase();
    if (VOID_TAGS.has(name) || match[3] === "/") continue;
    const index = match.index ?? 0;
    if (match[1] !== "/") {
      if (name === "h2" && depth === 0 && !open) {
        open = { start: index, contentStart: index + match[0].length };
      }
      depth += 1;
    } else {
      depth = Math.max(0, depth - 1);
      if (name === "h2" && depth === 0 && open) {
        boundaries.push({
          heading: toText(html.slice(open.contentStart, index)),
          start: open.start,
          end: index + match[0].length,
        });
        open = null;
      }
    }
  }
  return boundaries;
}

function extractConventions(html: string, enabled: boolean): Omit<PageSection, "id" | "heading"> {
  if (!enabled) return { html: html.trim(), specs: [], productSlug: null, productFallbackHtml: null, callouts: [] };
  let body = html;
  const specs: string[] = [];
  for (const match of body.matchAll(SPECS_LIST)) {
    for (const item of match[1].matchAll(LIST_ITEM)) specs.push(toText(item[1]));
  }
  body = body.replace(SPECS_LIST, "");

  let productSlug: string | null = null;
  let productFallbackHtml: string | null = null;
  body = body.replace(PRODUCT_FIGURE, (match, inner: string) => {
    const href = inner.match(PRODUCT_HREF);
    if (!href || productSlug) return match;
    productSlug = href[1];
    productFallbackHtml = match;
    return "";
  });

  const callouts: string[] = [];
  body = body.replace(BLOCKQUOTE, (_match, inner: string) => {
    callouts.push(toText(inner));
    return "";
  });
  return { html: body.trim(), specs, productSlug, productFallbackHtml, callouts };
}

export type ParsePageOptions = {
  pageTitle?: string;
  promoteLede?: boolean;
  extractConventions?: boolean;
  liftUpdatedLabel?: boolean;
};

export function parsePageHtml(html: string, options: ParsePageOptions = {}): ParsedPage {
  const {
    pageTitle,
    promoteLede = true,
    extractConventions: shouldExtract = true,
    liftUpdatedLabel = true,
  } = options;
  let normalized = normalizePageHtml(html);
  const leadingHeading = normalized.match(LEADING_H1);
  if (
    leadingHeading
    && pageTitle
    && toText(leadingHeading[1]).localeCompare(pageTitle.trim(), undefined, { sensitivity: "base" }) === 0
  ) {
    normalized = normalized.slice(leadingHeading[0].length).trim();
  }
  const boundaries = topLevelH2Boundaries(normalized);
  let lead = boundaries.length ? normalized.slice(0, boundaries[0].start) : normalized;
  const usedIds = new Map<string, number>();
  const sections = boundaries.map((boundary, index) => {
    const next = boundaries[index + 1];
    const base = slugifyHeading(boundary.heading);
    const seen = (usedIds.get(base) ?? 0) + 1;
    usedIds.set(base, seen);
    return {
      id: seen === 1 ? base : `${base}-${seen}`,
      heading: boundary.heading,
      ...extractConventions(normalized.slice(boundary.end, next?.start), shouldExtract),
    };
  });

  let updatedLabel: string | null = null;
  if (liftUpdatedLabel) {
    const match = lead.match(UPDATED_PARAGRAPH);
    if (match) {
      updatedLabel = `Last Updated:${match[1]}`.replace(/\s+/g, " ").trim();
      lead = lead.slice(match[0].length);
    }
  }
  let lede: string | null = null;
  if (promoteLede) {
    const match = lead.match(FIRST_PARAGRAPH);
    if (match) {
      lede = toText(match[1]);
      lead = lead.replace(match[0], "");
    }
  }
  return { updatedLabel, lede, lead: lead.trim(), sections };
}
