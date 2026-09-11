/**
 * === Blog Excerpt Resolution ===
 *
 * Pure helper: resolves the display excerpt for a blog post. An editor's
 * explicit excerpt is authoritative and returned verbatim (D-01, BLOG-03).
 * When absent, a plain-text excerpt is derived from the post body by
 * stripping tags, decoding the common named entities, collapsing
 * whitespace, and capping on a word boundary.
 *
 * No I/O, no framework imports — this module never references `@/lib/db`,
 * `@/lib/models`, or React. Every call site is responsible for handing it
 * whatever post-shaped object it has.
 */

const ELLIPSIS = "…";

// Single alternation pattern + lookup table decoded in ONE replace() pass,
// so a doubly-encoded entity (`&amp;lt;`) decodes exactly once — to
// `&lt;`, never further to `<`. Chaining sequential .replace() calls would
// re-scan the output of an earlier replacement and double-decode it.
const ENTITY_PATTERN = /&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g;
const ENTITY_REPLACEMENTS: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function stripAndDecode(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, " ");
  const decoded = withoutTags.replace(ENTITY_PATTERN, (match) => ENTITY_REPLACEMENTS[match] ?? match);
  return decoded.replace(/\s+/g, " ").trim();
}

function capAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut}${ELLIPSIS}`;
}

/**
 * Resolves the display excerpt for a post. `post.html` is optional and
 * nullable: the list read this phase uses returns summary rows, and until
 * a caller opts in to the wider column set (`getPublishedBlogPosts({
 * includeHtml: true })`) those rows carry no body at all — an absent body
 * is a normal input, not an error.
 */
export function resolveBlogExcerpt(
  post: { excerpt: string | null; html?: string | null },
  maxLength = 160,
): string {
  if (typeof post.excerpt === "string" && post.excerpt.trim() !== "") {
    return post.excerpt;
  }

  const derived = stripAndDecode(post.html ?? "");
  if (derived === "") {
    return "";
  }

  return capAtWordBoundary(derived, maxLength);
}
