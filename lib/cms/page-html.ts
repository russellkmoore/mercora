const EMPTY_ELEMENT = /<(p|div)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi;
const HIDDEN_DIV = /<div[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>\s*<\/div>/gi;
const STRAY_META = /<meta[^>]*>/gi;
const STYLE_ATTR = /\s+style=["'][^"']*["']/gi;
const BOLD_ONLY_PARAGRAPH = /<p>((?:\s*<(?:strong|b)>[\s\S]*?<\/(?:strong|b)>\s*)+)<\/p>/gi;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Remove common imported-HTML artifacts without rewriting stored content. */
export function normalizePageHtml(html: string): string {
  let normalized = html
    .replace(HIDDEN_DIV, "")
    .replace(STRAY_META, "")
    .replace(STYLE_ATTR, "")
    .replace(BOLD_ONLY_PARAGRAPH, (match, inner: string) => {
      const text = stripTags(inner).replace(/\s+/g, " ").trim();
      return text.endsWith("?") ? `<h2>${text}</h2>` : match;
    })
    .replace(EMPTY_ELEMENT, "");

  for (let pass = 0; pass < 5; pass += 1) {
    const collapsed = normalized.replace(EMPTY_ELEMENT, "");
    if (collapsed === normalized) break;
    normalized = collapsed;
  }
  return normalized.trim();
}
