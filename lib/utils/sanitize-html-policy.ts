export const SAFE_HTML_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'sub', 'sup', 'small', 'mark', 'abbr', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img', 'figure', 'figcaption',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div',
] as const;

export const SAFE_HTML_ATTRIBUTES = [
  'class', 'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height', 'loading',
  'span', 'colspan', 'rowspan', 'headers', 'scope',
  'start', 'reversed', 'type', 'value',
] as const;

export type HtmlSanitizerOptions = {
  allowedImageOrigin?: string;
};

function allowedImageBase(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const SAME_ORIGIN_SENTINEL = new URL('https://same-origin.invalid/');

function isSameOriginRelativeReference(value: string): boolean {
  try {
    return new URL(value, SAME_ORIGIN_SENTINEL).origin === SAME_ORIGIN_SENTINEL.origin;
  } catch {
    return false;
  }
}

/** Match the server sanitizer's link schemes while retaining relative links. */
export function isAllowedLinkSource(source: string): boolean {
  const href = source.trim();
  if (!href || href.startsWith('//')) return false;
  if (isSameOriginRelativeReference(href)) return true;

  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/**
 * Allow root-relative same-origin images, or HTTPS images within the exact
 * configured CDN origin/path. Protocol-relative and lookalike hosts fail.
 */
export function isAllowedImageSource(
  source: string,
  allowedImageOrigin?: string
): boolean {
  const src = source.trim();
  if (!src || src.startsWith('//')) return false;
  if (isSameOriginRelativeReference(src)) return true;

  const base = allowedImageBase(allowedImageOrigin);
  if (!base) return false;

  try {
    const candidate = new URL(src);
    if (candidate.protocol !== 'https:' || candidate.origin !== base.origin) return false;
    if (candidate.username || candidate.password) return false;

    const basePath = base.pathname.replace(/\/+$/, '') || '/';
    return basePath === '/' ||
      candidate.pathname === basePath ||
      candidate.pathname.startsWith(`${basePath}/`);
  } catch {
    return false;
  }
}
